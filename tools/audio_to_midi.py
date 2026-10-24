#!/usr/bin/env python3
"""
tools/audio_to_midi.py — transcribe a band recording (MP3/WAV) to MIDI.

    python -I tools/audio_to_midi.py <song.mp3> --out music/midi/<name>/ [--work-dir DIR] [--model-path DIR]

Pipeline (CPU only, a few minutes per song on 4 cores):
  1. ffmpeg decodes the file to 44.1 kHz stereo WAV in the work dir.
  2. Stem separation: Spleeter 4stems (vocals / drums / bass / other) with the model from
     https://github.com/deezer/spleeter/releases/download/v1.4.0/4stems.tar.gz extracted to
     <model-path>/4stems/. If Spleeter or the model is missing (or --no-spleeter) it falls back to
     librosa HPSS + band splitting (bass < 200 Hz of the harmonic part, the rest as "other",
     percussive part as drums, no vocals) and says so in the JSON ("separation").
  3. Beat tracking on the drums stem (librosa), a half-/double-time check on the kick pattern,
     the downbeat phase from the kick/snare/chord-change pattern, beats extrapolated across intro
     and outro, and a tempo map (median-smoothed inter-beat tempo; one set_tempo per change).
  4. basic-pitch on the vocals, bass and other stems (the model ships inside the wheel).
  5. Drums from the drums stem: onset detection, kick/snare/hat/crash by band energy and decay
     (GM notes 36 / 38 / 42 / 49, open hat 46 when the hat rings past 120 ms).
  6. Everything is quantized to a 16th-note grid relative to the detected beats (a drifting demo
     lands on the grid; the tempo map keeps the MIDI in time with the recording).
  7. Sections: beat-synchronous chroma + MFCC, agglomerative segmentation snapped to bar lines,
     labelled A/B/C... by similarity; written as MIDI markers.
  8. Key guess by Krumhansl-Schmuckler correlation on the harmonic stems.

Outputs in --out:  <name>.mid (tracks: Vocals, Guitar (other), Bass, Drums on channel 10; tempo map,
time signature, section markers), <name>_vocals.mid / _guitar.mid / _bass.mid / _drums.mid, and
<name>.json (bpm, tempo range, key, duration, sections, per-stem note counts and pitch stats).
The WAV stems stay in the work dir (default: <system temp>/audio_to_midi/<name>); nothing large
goes in --out.

Dependencies: tools/audio_requirements.txt (Python 3.10 — Spleeter needs TensorFlow < 2.10).
"""
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

try:
    import numpy as np
    import librosa
    import soundfile as sf
    import mido
except ImportError as e:  # pragma: no cover - environment check
    sys.exit(f"audio_to_midi: missing dependency ({e}). Install tools/audio_requirements.txt into a Python 3.10 venv "
             f"(uv venv --python 3.10 .venv-audio && uv pip install -r tools/audio_requirements.txt) and run with its python.")

TICKS_PER_BEAT = 480
STEPS_PER_BEAT = 4  # 16th grid
TICKS_PER_STEP = TICKS_PER_BEAT // STEPS_PER_BEAT
SR = 22050  # analysis sample rate
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
GM = {"kick": 36, "snare": 38, "hat": 42, "ohat": 46, "crash": 49}
STEM_RANGES = {  # basic-pitch frequency windows per stem (Hz)
    "vocals": (80.0, 1400.0),
    "bass": (30.0, 500.0),
    "other": (60.0, 2500.0),
}


def log(msg: str) -> None:
    print(f"[audio_to_midi] {msg}", file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------
# 1. decode
# ---------------------------------------------------------------------------

def decode(src: Path, work: Path) -> Path:
    wav = work / "mix.wav"
    if wav.exists() and wav.stat().st_mtime >= src.stat().st_mtime:
        return wav
    if shutil.which("ffmpeg") is None:
        sys.exit("audio_to_midi: ffmpeg is required to decode the source file")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ac", "2", "-ar", "44100", "-sample_fmt", "s16", str(wav)], check=True)
    return wav


# ---------------------------------------------------------------------------
# 2. separation
# ---------------------------------------------------------------------------

STEMS = ("vocals", "drums", "bass", "other")


def separate(mix: Path, work: Path, model_path: Path | None, allow_spleeter: bool) -> tuple[dict[str, Path], str]:
    stems = {s: work / f"{s}.wav" for s in STEMS}
    tag = work / "separation.txt"
    if all(p.exists() for p in stems.values()) and tag.exists():
        return stems, tag.read_text().strip()
    method = None
    if allow_spleeter:
        try:
            method = separate_spleeter(mix, stems, model_path)
        except Exception as e:  # noqa: BLE001 - any failure falls back
            log(f"spleeter unavailable ({type(e).__name__}: {e}); falling back to HPSS band split")
    if method is None:
        method = separate_hpss(mix, stems)
    tag.write_text(method + "\n")
    return stems, method


def separate_spleeter(mix: Path, stems: dict[str, Path], model_path: Path | None) -> str:
    """Runs Spleeter in a child process: its TensorFlow v1 graph session leaves the process in a state
    where basic-pitch's SavedModel no longer loads."""
    mp = Path(model_path) if model_path else Path(os.environ.get("MODEL_PATH", "pretrained_models"))
    model_dir = mp / "4stems"
    if not (model_dir / "model.index").exists():
        raise FileNotFoundError(f"no 4stems model at {model_dir} (extract 4stems.tar.gz there)")
    probe = model_dir / ".probe"
    if not probe.exists():
        probe.write_text("OK")  # Spleeter's "already downloaded" marker
    import importlib.util

    if importlib.util.find_spec("spleeter") is None:
        raise ImportError("spleeter is not installed")
    t0 = time.time()
    subprocess.run([sys.executable, "-I", str(Path(__file__).resolve()), "--_separate", str(mix), str(stems["vocals"].parent), str(mp)],
                   check=True, env={**os.environ, "TF_CPP_MIN_LOG_LEVEL": "2"})
    log(f"spleeter 4stems: {time.time() - t0:.0f} s")
    return "spleeter:4stems"


def _separate_child(mix: str, out_dir: str, model_path: str) -> None:
    os.environ["MODEL_PATH"] = model_path
    from spleeter.separator import Separator  # noqa: WPS433 - optional dependency
    from spleeter.audio.adapter import AudioAdapter

    sep = Separator("spleeter:4stems", multiprocess=False)
    wave, _sr = AudioAdapter.default().load(mix, sample_rate=44100)
    pred = sep.separate(wave)
    for name, data in pred.items():
        sf.write(os.path.join(out_dir, f"{name}.wav"), data.astype(np.float32), 44100)


def separate_hpss(mix: Path, stems: dict[str, Path]) -> str:
    """Plan B: harmonic/percussive split + a 200 Hz crossover. No vocal stem (an empty file)."""
    t0 = time.time()
    y, sr = librosa.load(str(mix), sr=44100, mono=True)
    harm, perc = librosa.effects.hpss(y, margin=(1.0, 3.0))
    from scipy.signal import butter, sosfiltfilt

    lo = sosfiltfilt(butter(4, 200.0, "lowpass", fs=sr, output="sos"), harm)
    hi = harm - lo
    sf.write(str(stems["bass"]), lo.astype(np.float32), sr)
    sf.write(str(stems["other"]), hi.astype(np.float32), sr)
    sf.write(str(stems["drums"]), perc.astype(np.float32), sr)
    sf.write(str(stems["vocals"]), np.zeros(len(y), dtype=np.float32), sr)
    log(f"hpss fallback: {time.time() - t0:.0f} s")
    return "hpss+bandsplit"


# ---------------------------------------------------------------------------
# 3. beats, downbeats, tempo map
# ---------------------------------------------------------------------------

def band_energy_at(y: np.ndarray, sr: int, times: np.ndarray, lo: float, hi: float, win: float = 0.06) -> np.ndarray:
    """Mean energy of y band-passed to [lo, hi] in a window after each time."""
    from scipy.signal import butter, sosfiltfilt

    nyq = sr / 2
    hi = min(hi, nyq * 0.95)
    if lo <= 0:
        sos = butter(4, hi, "lowpass", fs=sr, output="sos")
    elif hi >= nyq * 0.95:
        sos = butter(4, lo, "highpass", fs=sr, output="sos")
    else:
        sos = butter(4, [lo, hi], "bandpass", fs=sr, output="sos")
    yb = sosfiltfilt(sos, y)
    n = int(win * sr)
    out = np.zeros(len(times))
    for i, t in enumerate(times):
        a = max(0, int(t * sr))
        seg = yb[a:a + n]
        out[i] = float(np.mean(seg * seg)) if len(seg) else 0.0
    return out


def analyze_beats(drums: np.ndarray, harmonic: np.ndarray, sr: int, duration: float, start_bpm: float) -> dict:
    onset_env = librosa.onset.onset_strength(y=drums, sr=sr, aggregate=np.median)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, start_bpm=start_bpm, units="time", tightness=100, trim=False)
    tempo = float(np.atleast_1d(tempo)[0])
    beats = np.asarray(beats, dtype=float)
    if len(beats) < 8:  # a drum-less track: fall back to the whole mix
        onset_env = librosa.onset.onset_strength(y=harmonic, sr=sr, aggregate=np.median)
        tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, start_bpm=start_bpm, units="time", tightness=100, trim=False)
        tempo = float(np.atleast_1d(tempo)[0])
        beats = np.asarray(beats, dtype=float)
    ibi = np.median(np.diff(beats)) if len(beats) > 2 else 60.0 / tempo
    tempo = 60.0 / ibi
    # nudge the beats onto the drum attacks: the tracker's beats sit on onset-envelope peaks, which
    # lag the hits by a frame or two (20-40 ms), enough to pull 16ths the wrong way.
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, units="time", backtrack=False)
    if len(onsets):
        offs = []
        for b in beats:
            j = int(np.argmin(np.abs(onsets - b)))
            d = onsets[j] - b
            if abs(d) < 0.15 * ibi:
                offs.append(d)
        if len(offs) > len(beats) * 0.3:
            shift = float(np.median(offs))
            beats = beats + shift
            log(f"beats nudged {shift * 1000:+.0f} ms onto the drum attacks")
    # half-/double-time check on the kick pattern: punk sits in 140..220. If the tracker landed at
    # half that, the kicks between the tracked beats are as strong as the ones on the strongest beat
    # phase (a straight beat has its kicks on 1 and 3 and lighter ones on the "ands").
    mids = (beats[:-1] + beats[1:]) / 2
    kick_on = band_energy_at(drums, sr, beats[:-1], 0, 150)
    kick_mid = band_energy_at(drums, sr, mids, 0, 150)
    idx = np.arange(len(kick_on))
    strongest = max(float(np.mean(kick_on[idx % 4 == p])) for p in range(4)) if len(kick_on) >= 4 else float(np.mean(kick_on))
    ratio = float(np.mean(kick_mid) / (strongest + 1e-12)) if len(mids) else 0.0
    note = None
    if tempo < 118 and ratio > 0.6:
        beats = np.sort(np.concatenate([beats, mids]))
        tempo *= 2
        note = "doubled: tracker found half-time"
    elif tempo > 235:
        beats = beats[::2]
        tempo /= 2
        note = "halved: tracker found double-time"
    ibi = float(np.median(np.diff(beats)))

    # extrapolate beats over the whole file (intro before the first detected beat, outro after)
    first = beats[0]
    pre = []
    t = first - ibi
    while t > -ibi * 0.5:
        pre.append(t)
        t -= ibi
    post = []
    t = beats[-1] + ibi
    while t < duration + ibi:
        post.append(t)
        t += ibi
    beats = np.concatenate([np.array(pre[::-1]), beats, np.array(post)])
    n_tracked = (len(pre), len(post))

    # downbeat phase: kick on 1 and 3, snare on 2 and 4, chord changes on 1
    kick = band_energy_at(drums, sr, beats, 0, 150)
    snare = band_energy_at(drums, sr, beats, 180, 2500)
    kick = kick / (kick.max() + 1e-12)
    snare = snare / (snare.max() + 1e-12)
    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr, hop_length=512)
    frames = librosa.time_to_frames(beats, sr=sr, hop_length=512)
    frames = np.clip(frames, 0, chroma.shape[1] - 1)
    bc = chroma[:, frames]
    change = np.zeros(len(beats))
    for i in range(1, len(beats)):
        a, b = bc[:, i - 1], bc[:, i]
        change[i] = 1 - float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))
    change = change / (change.max() + 1e-12)
    best, best_score = 0, -1e9
    for p in range(4):
        idx = np.arange(len(beats))
        on1 = (idx % 4) == p
        on3 = (idx % 4) == (p + 2) % 4
        on2 = (idx % 4) == (p + 1) % 4
        on4 = (idx % 4) == (p + 3) % 4
        score = (kick[on1].sum() * 1.5 + kick[on3].sum() + snare[on2].sum() + snare[on4].sum()
                 - snare[on1].sum() - snare[on3].sum() + change[on1].sum() * 2 - change[on2].sum() - change[on4].sum())
        if score > best_score:
            best, best_score = p, score
    # beat index -> grid beat number so that beat `best` is a downbeat; keep a pickup bar if needed
    offset_beats = (4 - best) % 4  # beats before the first downbeat (pickup)
    lead_bars = 1 if offset_beats else 0
    grid0 = lead_bars * 4 - offset_beats  # grid beat number of beats[0]

    # tempo map: local tempo over a 16-beat window (the tracker's 23 ms frame grid makes single
    # inter-beat intervals jitter by several BPM), one entry per change > 1.5 BPM, 8 beats apart.
    n = len(beats)
    smooth = np.zeros(max(1, n - 1))
    half = 8
    for i in range(n - 1):
        a, b = max(0, i - half), min(n - 1, i + half)
        smooth[i] = 60.0 * (b - a) / (beats[b] - beats[a])
    tempo_map = []
    last, last_i = None, -99
    for i, bpm in enumerate(smooth):
        bpm_r = round(float(bpm), 1)
        if last is None or (abs(bpm_r - last) > 1.5 and i - last_i >= 8):
            tempo_map.append((i, bpm_r))
            last, last_i = bpm_r, i
    return {
        "beats": beats, "grid0": grid0, "bpm": round(float(np.median(smooth)), 1), "bpm_min": round(float(smooth.min()), 1),
        "bpm_max": round(float(smooth.max()), 1), "tempo_map": tempo_map, "downbeat_phase": int(best), "note": note,
        "extrapolated": n_tracked, "kick_mid_ratio": round(ratio, 2), "onset_env": onset_env,
    }


class Grid:
    """Maps recording time <-> 16th-note grid relative to the tracked beats."""

    def __init__(self, beats: np.ndarray, grid0: int):
        self.beats = beats
        self.grid0 = grid0

    def beat_pos(self, t: float) -> float:
        """Continuous beat number (grid units) of time t, linear inside each beat interval."""
        b = self.beats
        i = int(np.searchsorted(b, t, side="right") - 1)
        if i < 0:
            return self.grid0 + (t - b[0]) / (b[1] - b[0])
        if i >= len(b) - 1:
            return self.grid0 + (len(b) - 1) + (t - b[-1]) / (b[-1] - b[-2])
        return self.grid0 + i + (t - b[i]) / (b[i + 1] - b[i])

    def step(self, t: float) -> int:
        return int(round(self.beat_pos(t) * STEPS_PER_BEAT))

    def tick(self, t: float) -> int:
        return max(0, self.step(t) * TICKS_PER_STEP)

    def time_of_beat(self, beat: int) -> float:
        i = beat - self.grid0
        b = self.beats
        if 0 <= i < len(b):
            return float(b[i])
        if i < 0:
            return float(b[0] + i * (b[1] - b[0]))
        return float(b[-1] + (i - (len(b) - 1)) * (b[-1] - b[-2]))

    @property
    def total_beats(self) -> int:
        return self.grid0 + len(self.beats)


# ---------------------------------------------------------------------------
# 4. pitched stems
# ---------------------------------------------------------------------------

def transcribe_pitched(path: Path, stem: str, grid: Grid) -> list[dict]:
    y, sr = librosa.load(str(path), sr=SR, mono=True)
    if float(np.sqrt(np.mean(y * y))) < 1e-4:
        return []
    from basic_pitch import ICASSP_2022_MODEL_PATH
    from basic_pitch.inference import predict

    lo, hi = STEM_RANGES[stem]
    _out, _midi, events = predict(
        str(path), model_or_model_path=ICASSP_2022_MODEL_PATH, onset_threshold=0.5, frame_threshold=0.3,
        minimum_note_length=70, minimum_frequency=lo, maximum_frequency=hi, melodia_trick=True,
    )
    notes = []
    for ev in events:
        start, end, pitch, amp = ev[0], ev[1], int(ev[2]), float(ev[3])
        s0 = grid.step(start)
        s1 = max(s0 + 1, grid.step(end))
        notes.append({"step": s0, "len": s1 - s0, "pitch": pitch, "vel": int(np.clip(round(amp * 127), 1, 127)), "t": round(float(start), 3)})
    notes.sort(key=lambda n: (n["step"], -n["vel"], n["pitch"]))
    return notes


# ---------------------------------------------------------------------------
# 5. drums
# ---------------------------------------------------------------------------

def transcribe_drums(path: Path, grid: Grid) -> list[dict]:
    y, sr = librosa.load(str(path), sr=SR, mono=True)
    if float(np.sqrt(np.mean(y * y))) < 1e-4:
        return []
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, units="time", backtrack=False, delta=0.07, wait=2)
    if len(onsets) == 0:
        return []
    low = band_energy_at(y, sr, onsets, 0, 150, 0.06)
    mid = band_energy_at(y, sr, onsets, 200, 2500, 0.06)
    high = band_energy_at(y, sr, onsets, 5000, 11000, 0.05)
    high_late = band_energy_at(y, sr, onsets + 0.25, 5000, 11000, 0.12)  # ring after the hit
    high_mid = band_energy_at(y, sr, onsets + 0.12, 5000, 11000, 0.06)
    p = lambda a: float(np.percentile(a, 90)) + 1e-12  # noqa: E731
    low_n, mid_n, high_n = low / p(low), mid / p(mid), high / p(high)
    hits = []
    for i, t in enumerate(onsets):
        step = grid.step(float(t))
        total = low[i] + mid[i] + high[i] + 1e-12
        classes = []
        if low_n[i] > 0.18 and low[i] / total > 0.25:
            classes.append("kick")
        if mid_n[i] > 0.22 and mid[i] / total > 0.2 and mid[i] > low[i] * 0.4:
            classes.append("snare")
        if high_n[i] > 0.12:
            ring = high_late[i] / (high[i] + 1e-12)
            if high_n[i] > 0.5 and ring > 0.25 and (mid_n[i] > 0.3 or high_n[i] > 0.9):
                classes.append("crash")
            elif high_mid[i] / (high[i] + 1e-12) > 0.45 and "snare" not in classes:
                classes.append("ohat")
            else:
                classes.append("hat")
        if not classes:
            # a quiet hit: call it by its dominant band
            classes.append(["kick", "snare", "hat"][int(np.argmax([low_n[i], mid_n[i], high_n[i]]))])
        vel = int(np.clip(round(40 + 87 * min(1.0, max(low_n[i], mid_n[i], high_n[i]))), 1, 127))
        for c in classes:
            hits.append({"step": step, "drum": c, "vel": vel, "t": round(float(t), 3)})
    # one hit per (step, drum): keep the loudest
    best: dict[tuple[int, str], dict] = {}
    for h in hits:
        k = (h["step"], h["drum"])
        if k not in best or h["vel"] > best[k]["vel"]:
            best[k] = h
    return sorted(best.values(), key=lambda h: (h["step"], h["drum"]))


# ---------------------------------------------------------------------------
# 6. sections and key
# ---------------------------------------------------------------------------

def detect_sections(mix: np.ndarray, harmonic: np.ndarray, sr: int, grid: Grid, duration: float) -> list[dict]:
    beats = grid.beats
    frames = np.clip(librosa.time_to_frames(beats, sr=sr, hop_length=512), 0, None)
    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr, hop_length=512)
    mfcc = librosa.feature.mfcc(y=mix, sr=sr, hop_length=512, n_mfcc=13)
    frames = np.clip(frames, 0, min(chroma.shape[1], mfcc.shape[1]) - 1)
    bchroma = librosa.util.sync(chroma, frames, aggregate=np.median)
    bmfcc = librosa.util.sync(mfcc, frames, aggregate=np.mean)
    feats = np.vstack([librosa.util.normalize(bchroma, axis=0) * 2, librosa.util.normalize(bmfcc, axis=1)])
    # bar-synchronous features (a bar = 4 grid beats)
    first_bar_beat = 0
    n_beats = feats.shape[1]
    bar_feats, bar_beats = [], []
    b = first_bar_beat
    while b + 4 <= n_beats:
        bar_feats.append(feats[:, b:b + 4].mean(axis=1))
        bar_beats.append(b)
        b += 4
    if len(bar_feats) < 4:
        return []
    bar_feats = np.array(bar_feats).T
    n_bars = bar_feats.shape[1]
    # Foote novelty on the bar-level self-similarity matrix (checkerboard kernel of 4 bars), peaks
    # at least 4 bars apart; up to ~one section per 12 s.
    x = bar_feats - bar_feats.mean(axis=1, keepdims=True)
    x = x / (np.linalg.norm(x, axis=0, keepdims=True) + 1e-9)
    ssm = x.T @ x
    kw = 4
    kern = np.outer(np.r_[-np.ones(kw), np.ones(kw)], np.r_[-np.ones(kw), np.ones(kw)])
    nov = np.zeros(n_bars)
    for i in range(kw, n_bars - kw):
        nov[i] = float((ssm[i - kw:i + kw, i - kw:i + kw] * kern).sum())
    nov = np.maximum(nov, 0)
    nov = nov / (nov.max() + 1e-9)
    max_sections = int(max(2, round(duration / 12.0)))
    peaks = librosa.util.peak_pick(nov, pre_max=3, post_max=3, pre_avg=4, post_avg=4, delta=0.08, wait=3)
    peaks = sorted(peaks, key=lambda i: -nov[i])[: max_sections - 1]
    bounds = sorted({0, *[int(p) for p in peaks]})
    labels = np.zeros(n_bars, dtype=int)
    # label the segments by similarity of their mean features (A, B, C ...)
    seg_means = []
    for j, s in enumerate(bounds):
        e = bounds[j + 1] if j + 1 < len(bounds) else len(labels)
        seg_means.append(bar_feats[:, s:e].mean(axis=1))
    names, proto = [], []
    for m in seg_means:
        found = None
        for li, pm in enumerate(proto):
            d = np.linalg.norm(m - pm) / (np.linalg.norm(pm) + 1e-9)
            if d < 0.35:
                found = li
                break
        if found is None:
            proto.append(m)
            found = len(proto) - 1
        names.append(chr(ord("A") + found) if found < 26 else f"S{found}")
    out = []
    for j, s in enumerate(bounds):
        e = bounds[j + 1] if j + 1 < len(bounds) else len(labels)
        beat_in_grid = grid.grid0 + bar_beats[s]
        bar = beat_in_grid // 4
        out.append({"label": names[j], "bar": int(bar), "bars": int(e - s), "time": round(grid.time_of_beat(beat_in_grid), 2)})
    return out


KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def guess_key(harmonic: np.ndarray, sr: int) -> dict:
    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr).mean(axis=1)
    best = None
    for tonic in range(12):
        for mode, prof in (("major", KS_MAJOR), ("minor", KS_MINOR)):
            r = float(np.corrcoef(np.roll(prof, tonic), chroma)[0, 1])
            if best is None or r > best[2]:
                best = (tonic, mode, r)
    tonic, mode, r = best
    return {"key": f"{NOTE_NAMES[tonic]} {mode}", "confidence": round(r, 3), "chroma": [round(float(c), 3) for c in chroma / (chroma.max() + 1e-9)]}


# ---------------------------------------------------------------------------
# 7. MIDI
# ---------------------------------------------------------------------------

def meta_track(name: str, beat_info: dict, grid: Grid, sections: list[dict], key: str) -> mido.MidiTrack:
    tr = mido.MidiTrack()
    tr.append(mido.MetaMessage("track_name", name=name, time=0))
    tr.append(mido.MetaMessage("time_signature", numerator=4, denominator=4, time=0))
    try:
        tr.append(mido.MetaMessage("key_signature", key=key.replace(" minor", "m").replace(" major", "").replace("#", "#"), time=0))
    except Exception:  # noqa: BLE001 - mido rejects some spellings (e.g. A#m); the JSON still has the key
        pass
    events = []
    for beat_index, bpm in beat_info["tempo_map"]:
        tick = (grid.grid0 + beat_index) * TICKS_PER_BEAT
        events.append((tick, 0, mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm))))
    if not events or events[0][0] > 0:
        events.insert(0, (0, 0, mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(beat_info["bpm"]))))
    for s in sections:
        events.append((s["bar"] * 4 * TICKS_PER_BEAT, 1, mido.MetaMessage("marker", text=f"{s['label']} ({s['bars']} bars)")))
    events.sort(key=lambda e: (e[0], e[1]))
    last = 0
    for tick, _, msg in events:
        msg.time = tick - last
        tr.append(msg)
        last = tick
    tr.append(mido.MetaMessage("end_of_track", time=0))
    return tr


def note_track(name: str, channel: int, program: int | None, notes: list[dict]) -> mido.MidiTrack:
    tr = mido.MidiTrack()
    tr.append(mido.MetaMessage("track_name", name=name, time=0))
    if program is not None:
        tr.append(mido.Message("program_change", channel=channel, program=program, time=0))
    events = []
    for n in notes:
        on = n["step"] * TICKS_PER_STEP
        off = on + n["len"] * TICKS_PER_STEP
        events.append((on, 1, mido.Message("note_on", channel=channel, note=n["pitch"], velocity=n["vel"])))
        events.append((off, 0, mido.Message("note_off", channel=channel, note=n["pitch"], velocity=0)))
    events.sort(key=lambda e: (e[0], e[1]))
    last = 0
    for tick, _, msg in events:
        msg.time = tick - last
        tr.append(msg)
        last = tick
    tr.append(mido.MetaMessage("end_of_track", time=0))
    return tr


def drum_track(hits: list[dict]) -> mido.MidiTrack:
    notes = [{"step": h["step"], "len": 1, "pitch": GM[h["drum"]], "vel": h["vel"]} for h in hits]
    return note_track("Drums", 9, None, notes)


def write_midi(path: Path, tracks: list[mido.MidiTrack]) -> None:
    mid = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT, type=1)
    for t in tracks:
        mid.tracks.append(t)
    mid.save(str(path))


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def stem_stats(notes: list[dict]) -> dict:
    if not notes:
        return {"notes": 0}
    pitches = np.array([n["pitch"] for n in notes])
    lens = np.array([n["len"] for n in notes])
    hist = np.zeros(12)
    for n in notes:
        hist[n["pitch"] % 12] += n["len"]
    hist = hist / hist.sum()
    return {
        "notes": int(len(notes)), "pitch_min": int(pitches.min()), "pitch_max": int(pitches.max()), "pitch_median": int(np.median(pitches)),
        "median_len_steps": float(np.median(lens)),
        "pitch_class_hist": {NOTE_NAMES[i]: round(float(hist[i]), 3) for i in range(12)},
        "first_step": int(notes[0]["step"]), "last_step": int(max(n["step"] + n["len"] for n in notes)),
    }


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "--_separate":
        _separate_child(*sys.argv[2:5])
        return
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", help="song file (mp3/wav/anything ffmpeg reads)")
    ap.add_argument("--out", required=True, help="output directory (created)")
    ap.add_argument("--name", help="base name (default: the source file's stem)")
    ap.add_argument("--work-dir", help="where the decoded mix and the stems live (default: <tmp>/audio_to_midi/<name>)")
    ap.add_argument("--model-path", help="directory containing 4stems/ (Spleeter's MODEL_PATH)")
    ap.add_argument("--no-spleeter", action="store_true", help="skip Spleeter, use the HPSS fallback")
    ap.add_argument("--start-bpm", type=float, default=170.0, help="beat tracker prior (punk: 150-210)")
    args = ap.parse_args()

    src = Path(args.src).resolve()
    if not src.exists():
        sys.exit(f"audio_to_midi: {src} not found")
    name = args.name or src.stem
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    work = Path(args.work_dir).resolve() if args.work_dir else Path(tempfile.gettempdir()) / "audio_to_midi" / name
    work.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    mix_path = decode(src, work)
    stems, method = separate(mix_path, work, Path(args.model_path).resolve() if args.model_path else None, not args.no_spleeter)
    log(f"stems ready ({method})")

    mix, sr = librosa.load(str(mix_path), sr=SR, mono=True)
    duration = len(mix) / sr
    drums, _ = librosa.load(str(stems["drums"]), sr=SR, mono=True)
    harmonic = np.zeros_like(mix)
    for s in ("bass", "other", "vocals"):
        y, _ = librosa.load(str(stems[s]), sr=SR, mono=True)
        harmonic[: len(y)] += y[: len(harmonic)]
    beat_info = analyze_beats(drums, harmonic, sr, duration, args.start_bpm)
    grid = Grid(beat_info["beats"], beat_info["grid0"])
    log(f"tempo {beat_info['bpm']} BPM ({beat_info['bpm_min']}-{beat_info['bpm_max']}), downbeat phase {beat_info['downbeat_phase']}, "
        f"{len(beat_info['tempo_map'])} tempo changes{' [' + beat_info['note'] + ']' if beat_info['note'] else ''}")

    key = guess_key(harmonic, sr)
    tuning = float(librosa.estimate_tuning(y=harmonic, sr=sr, resolution=0.01))  # semitones off A440 (-0.5..0.5)
    sections = detect_sections(mix, harmonic, sr, grid, duration)
    log(f"key {key['key']} ({key['confidence']}), tuning {tuning:+.2f} st; sections: " + " ".join(f"{s['label']}@{s['bar']}x{s['bars']}" for s in sections))

    tracks: dict[str, list[dict]] = {}
    for stem in ("vocals", "bass", "other"):
        tracks[stem] = transcribe_pitched(stems[stem], stem, grid)
        log(f"{stem}: {len(tracks[stem])} notes")
    hits = transcribe_drums(stems["drums"], grid)
    log(f"drums: {len(hits)} hits")

    meta = lambda label: meta_track(label, beat_info, grid, sections, key["key"])  # noqa: E731
    vocals_tr = note_track("Vocals", 0, 53, tracks["vocals"])
    guitar_tr = note_track("Guitar (other)", 1, 30, tracks["other"])
    bass_tr = note_track("Bass", 2, 33, tracks["bass"])
    drums_tr = drum_track(hits)
    write_midi(out / f"{name}.mid", [meta(name), vocals_tr, guitar_tr, bass_tr, drums_tr])
    write_midi(out / f"{name}_vocals.mid", [meta(f"{name} vocals"), note_track("Vocals", 0, 53, tracks["vocals"])])
    write_midi(out / f"{name}_guitar.mid", [meta(f"{name} guitar"), note_track("Guitar (other)", 1, 30, tracks["other"])])
    write_midi(out / f"{name}_bass.mid", [meta(f"{name} bass"), note_track("Bass", 2, 33, tracks["bass"])])
    write_midi(out / f"{name}_drums.mid", [meta(f"{name} drums"), drum_track(hits)])

    drum_counts: dict[str, int] = {}
    for h in hits:
        drum_counts[h["drum"]] = drum_counts.get(h["drum"], 0) + 1
    total_bars = math.ceil(grid.total_beats / 4)
    report = {
        "name": name, "source": src.name, "duration_s": round(duration, 2), "separation": method,
        "bpm": beat_info["bpm"], "bpm_range": [beat_info["bpm_min"], beat_info["bpm_max"]], "tempo_changes": len(beat_info["tempo_map"]),
        "tempo_map": [{"beat": int(b), "bpm": bpm} for b, bpm in beat_info["tempo_map"]],
        "beat_tracking_note": beat_info["note"], "kick_between_beats_ratio": beat_info["kick_mid_ratio"],
        "downbeat_phase": beat_info["downbeat_phase"], "pickup_beats": (4 - beat_info["downbeat_phase"]) % 4,
        "first_beat_time": round(float(grid.beats[0]), 3), "grid_beat_of_first_tracked_beat": grid.grid0,
        "bars": total_bars, "ticks_per_beat": TICKS_PER_BEAT, "steps_per_beat": STEPS_PER_BEAT,
        "key": key["key"], "key_confidence": key["confidence"], "chroma": key["chroma"], "tuning_semitones": round(tuning, 2),
        "sections": sections,
        "stems": {
            "vocals": stem_stats(tracks["vocals"]), "guitar": stem_stats(tracks["other"]), "bass": stem_stats(tracks["bass"]),
            "drums": {"hits": len(hits), **{k: v for k, v in sorted(drum_counts.items())}},
        },
        "files": {
            "midi": f"{name}.mid", "vocals": f"{name}_vocals.mid", "guitar": f"{name}_guitar.mid", "bass": f"{name}_bass.mid", "drums": f"{name}_drums.mid",
        },
        "work_dir": str(work), "elapsed_s": round(time.time() - t0, 1),
    }
    (out / f"{name}.json").write_text(json.dumps(report, indent=2) + "\n")
    log(f"wrote {out / (name + '.mid')} (+4 stem MIDIs, {name}.json) in {report['elapsed_s']} s")


if __name__ == "__main__":
    main()
