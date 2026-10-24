#!/usr/bin/env python3
"""
tools/midi_to_song.py — turn a transcription MIDI (from tools/audio_to_midi.py) into a draft song file
in the game's format (docs/ARCHITECTURE.md §7, src/audio/README.md).

    python3 -I tools/midi_to_song.py music/midi/<name>/<name>.mid --id band_<name> --title "Title" \
        --out src/audio/songs/band_<name>.js [--bars 16-48,64-80] [--max-bars 64] [--bpm 170] [--lead-octave 1] \
        [--no-regular-hats] [--loop-start N] [--print-summary]

Only the standard library is needed (the MIDI parser is here). Reductions:
  pulse1  = the vocal melody, monophonic: per 16th slot the loudest/longest note starting there wins,
            the line is shifted into C4..C6 and octave jumps outside that range are folded back.
            When the MIDI has no vocals (an instrumental) pulse1 takes the guitar's top voice instead.
  pulse2  = the guitar reduced to a riff: per slot the lowest strong onset is the chord root (power chords
            collapse to it), held chords re-strike on every 8th with the fifth on the alternate 8ths.
            25 % duty, folded into E3..E5.
  tri     = the bass: lowest note per slot, re-struck every 8th when held, folded into E2..E4. When the
            bass stem is (nearly) empty the triangle takes the guitar roots an octave down.
  noise   = the kit (crash > snare > kick, one per step); hats/open hats on a second noise channel. By
            default a bar in which the kit plays gets closed hats on every 8th (punk hats are easier to
            hear than to transcribe); --no-regular-hats keeps only the detected ones.
Arrangement: identical bars share a pattern; the bars come from --bars (ranges, inclusive), or from the
JSON's sections (adjacent repeats of the same section collapse, capped at --max-bars, 4-bar aligned).
The result is a draft: listen, then edit the pattern strings by hand.
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
from collections import Counter, defaultdict
from pathlib import Path

STEPS_PER_BAR = 16
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
GM_DRUMS = {36: "k", 35: "k", 38: "s", 40: "s", 37: "s", 42: "h", 44: "h", 46: "o", 49: "c", 57: "c", 55: "c", 52: "c"}


# ---------------------------------------------------------------------------
# minimal Standard MIDI File reader (type 0/1), enough for what audio_to_midi.py writes
# ---------------------------------------------------------------------------

def _varlen(data: bytes, i: int) -> tuple[int, int]:
    v = 0
    while True:
        b = data[i]
        i += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, i


def read_midi(path: Path) -> dict:
    data = path.read_bytes()
    if data[:4] != b"MThd":
        sys.exit(f"{path}: not a MIDI file")
    hlen = struct.unpack(">I", data[4:8])[0]
    _fmt, ntracks, division = struct.unpack(">HHH", data[8:14])
    if division & 0x8000:
        sys.exit("SMPTE time division is not supported")
    pos = 8 + hlen
    tracks = []
    for _ in range(ntracks):
        if data[pos:pos + 4] != b"MTrk":
            sys.exit("bad track chunk")
        tlen = struct.unpack(">I", data[pos + 4:pos + 8])[0]
        chunk = data[pos + 8:pos + 8 + tlen]
        pos += 8 + tlen
        i, tick, status = 0, 0, 0
        name, notes, markers, tempos = "", [], [], []
        open_notes: dict[tuple[int, int], tuple[int, int]] = {}
        while i < len(chunk):
            delta, i = _varlen(chunk, i)
            tick += delta
            b = chunk[i]
            if b == 0xFF:
                mtype = chunk[i + 1]
                ln, j = _varlen(chunk, i + 2)
                payload = chunk[j:j + ln]
                i = j + ln
                if mtype == 0x03:
                    name = payload.decode("latin-1")
                elif mtype == 0x06:
                    markers.append((tick, payload.decode("latin-1")))
                elif mtype == 0x51:
                    tempos.append((tick, 60_000_000 / int.from_bytes(payload, "big")))
                continue
            if b in (0xF0, 0xF7):
                ln, j = _varlen(chunk, i + 1)
                i = j + ln
                continue
            if b & 0x80:
                status = b
                i += 1
            kind = status & 0xF0
            ch = status & 0x0F
            if kind in (0x80, 0x90, 0xA0, 0xB0, 0xE0):
                d1, d2 = chunk[i], chunk[i + 1]
                i += 2
                if kind == 0x90 and d2 > 0:
                    open_notes[(ch, d1)] = (tick, d2)
                elif kind == 0x80 or (kind == 0x90 and d2 == 0):
                    if (ch, d1) in open_notes:
                        t0, vel = open_notes.pop((ch, d1))
                        notes.append({"tick": t0, "end": max(tick, t0 + 1), "pitch": d1, "vel": vel, "ch": ch})
            elif kind in (0xC0, 0xD0):
                i += 1
            else:
                sys.exit(f"unexpected status byte {status:#x}")
        notes.sort(key=lambda n: (n["tick"], n["pitch"]))
        tracks.append({"name": name, "notes": notes, "markers": markers, "tempos": tempos})
    return {"division": division, "tracks": tracks}


# ---------------------------------------------------------------------------
# reductions
# ---------------------------------------------------------------------------

def to_steps(notes: list[dict], tps: int) -> list[dict]:
    out = []
    for n in notes:
        s0 = n["tick"] // tps
        s1 = max(s0 + 1, round(n["end"] / tps))
        out.append({"step": s0, "len": s1 - s0, "pitch": n["pitch"], "vel": n["vel"]})
    return out


def fold(pitch: int, lo: int, hi: int) -> int:
    while pitch < lo:
        pitch += 12
    while pitch > hi:
        pitch -= 12
    return pitch


def group8(notes: list[dict]) -> dict[int, list[dict]]:
    """Notes grouped by the 8th note (2 steps) they start in."""
    by: dict[int, list[dict]] = defaultdict(list)
    for n in notes:
        by[n["step"] // 2].append(n)
    return by


def mono_line(notes: list[dict], n_steps: int, lo: int, hi: int, octave_shift: int = 0, min_vel_frac: float = 0.3,
              pick: str = "strong", unit: int = 2) -> list[int | None]:
    """A monophonic line on an 8th-note (unit=2) or beat (unit=4) grid: per slot the best note starting
    there (loudest*longest, or the highest/lowest), held until it ends or the next onset. The line is
    shifted by octave_shift and folded into lo..hi; a leap over a 7th folds back an octave (singers do
    not jump like that, octave errors in the transcription do). Returns per-step pitch (None rest, -1 hold)."""
    line: list[int | None] = [None] * n_steps
    if not notes:
        return line
    vmax = max(n["vel"] for n in notes)
    by_slot: dict[int, list[dict]] = defaultdict(list)
    for n in notes:
        if n["vel"] >= vmax * min_vel_frac:
            by_slot[n["step"] // unit].append(n)
    slots = sorted(by_slot)
    prev = None
    for k, sl in enumerate(slots):
        cands = by_slot[sl]
        if pick == "high":
            best = max(cands, key=lambda n: (n["pitch"], n["vel"]))
        elif pick == "low":
            best = min(cands, key=lambda n: (n["pitch"], -n["vel"]))
        else:
            best = max(cands, key=lambda n: n["vel"] * (n["len"] ** 0.5))
        p = fold(best["pitch"] + 12 * octave_shift, lo, hi)
        if prev is not None and abs(p - prev) > 9:
            if p > prev and p - 12 >= lo:
                p -= 12
            elif p < prev and p + 12 <= hi:
                p += 12
        s = sl * unit
        if s >= n_steps:
            break
        end = max(s + unit, s + best["len"])
        if k + 1 < len(slots):
            end = min(end, slots[k + 1] * unit)
        end = min(end, n_steps)
        line[s] = p
        for j in range(s + 1, end):
            line[j] = -1
        prev = p
    return line


def chord_roots(notes: list[dict], n_steps: int) -> list[int | None]:
    """Chord root per beat: among the strong onsets in the beat, the most common pitch class weighted by
    velocity, voiced in the lowest octave seen for it. A beat without onsets keeps the previous root
    while the previous chord is still sounding, else rests. Returns per-beat MIDI pitch or None."""
    n_beats = n_steps // 4
    roots: list[int | None] = [None] * n_beats
    if not notes:
        return roots
    vmax = max(n["vel"] for n in notes)
    by_beat: dict[int, list[dict]] = defaultdict(list)
    for n in notes:
        if n["vel"] >= vmax * 0.3:
            by_beat[n["step"] // 4].append(n)
    sounding_until = -1
    prev = None
    for b in range(n_beats):
        cands = by_beat.get(b, [])
        if cands:
            top = max(n["vel"] for n in cands)
            strong = [n for n in cands if n["vel"] >= top * 0.5]
            # the lowest note of each onset moment is the candidate root; vote by velocity
            votes: dict[int, float] = defaultdict(float)
            lowest: dict[int, int] = {}
            by_step: dict[int, list[dict]] = defaultdict(list)
            for n in strong:
                by_step[n["step"]].append(n)
            for st, ns in by_step.items():
                r = min(ns, key=lambda n: n["pitch"])
                pc = r["pitch"] % 12
                votes[pc] += r["vel"] * (1.5 if st == b * 4 else 1.0)
                lowest[pc] = min(lowest.get(pc, 999), r["pitch"])
            pc = max(votes, key=votes.get)
            # power chords: when the fifth out-votes the root (the low string is often the weaker
            # transcription), the pitch class a fifth below with a comparable vote is the root
            below = (pc - 7) % 12
            if below in votes and votes[below] >= 0.4 * votes[pc]:
                pc = below
            prev = lowest[pc]
            roots[b] = prev
            sounding_until = max(n["step"] + n["len"] for n in strong)
        elif prev is not None and b * 4 < sounding_until:
            roots[b] = prev
        else:
            roots[b] = None
    # a one-beat chord between two identical neighbours is a transcription flicker
    for b in range(1, n_beats - 1):
        if roots[b] is not None and roots[b - 1] is not None and roots[b - 1] == roots[b + 1] and roots[b] != roots[b - 1] \
           and roots[b] % 12 != roots[b - 1] % 12:
            roots[b] = roots[b - 1]
    return roots


def riff_from_roots(roots: list[int | None], lo: int, hi: int, drive: bool = True) -> list[int | None]:
    """8th-note downstrokes on the chord root (note, rest), the fifth on the off-8th of beats 2 and 4
    while the chord holds; without drive: one note per beat held."""
    n_steps = len(roots) * 4
    line: list[int | None] = [None] * n_steps
    for b, r in enumerate(roots):
        if r is None:
            continue
        p = fold(r, lo, hi)
        s = b * 4
        if not drive:
            line[s] = p
            for j in range(s + 1, s + 4):
                line[j] = -1
            continue
        line[s] = p
        same_next = b + 1 < len(roots) and roots[b + 1] is not None and roots[b + 1] % 12 == r % 12
        line[s + 2] = fold(p + 7, lo, hi + 7) if (b % 2 == 1 and same_next) else p
    return line


def bass_from_roots(roots: list[int | None], lo: int, hi: int) -> list[int | None]:
    """Legato root 8ths an octave under the riff, with an octave jump on the last 8th of beat 4 when the
    chord carries on (west_bank style)."""
    n_steps = len(roots) * 4
    line: list[int | None] = [None] * n_steps
    for b, r in enumerate(roots):
        if r is None:
            continue
        p = fold(r, lo, hi)
        s = b * 4
        line[s] = p
        line[s + 1] = -1
        same_next = b + 1 < len(roots) and roots[b + 1] is not None and roots[b + 1] % 12 == r % 12
        line[s + 2] = (p + 12 if (b % 4 == 3 and same_next and p + 12 <= hi + 5) else p)
        line[s + 3] = -1
    return line


def fill_short_rests(line: list[int | None], max_gap: int = 8) -> list[int | None]:
    """Hold a note through a rest of up to max_gap steps that is followed by another note: the
    triangle is the bed that keeps the engine's output from falling to digital silence between
    downstrokes (src/audio/README.md tip 13)."""
    out = list(line)
    n = len(out)
    i = 0
    while i < n:
        if out[i] is None:
            j = i
            while j < n and out[j] is None:
                j += 1
            if 0 < i and j < n and j - i <= max_gap and out[i - 1] is not None:
                for k in range(i, j):
                    out[k] = -1
            i = j
        else:
            i += 1
    return out


def bass_agrees(bass: list[dict], roots: list[int | None]) -> float:
    """Fraction of bass onsets whose pitch class matches the guitar root of their beat (0 when no bass)."""
    if not bass:
        return 0.0
    hit = total = 0
    for n in bass:
        b = n["step"] // 4
        if b < len(roots) and roots[b] is not None:
            total += 1
            if n["pitch"] % 12 == roots[b] % 12:
                hit += 1
    return hit / total if total else 0.0


def retrigger(line: list[int | None], every: int = 2, min_hold: int = 4) -> list[int | None]:
    """Re-strike held notes every `every` steps once a hold reaches `min_hold` (8th-note bass drive)."""
    out = list(line)
    i = 0
    n = len(line)
    while i < n:
        if out[i] is not None and out[i] != -1:
            j = i + 1
            while j < n and out[j] == -1:
                j += 1
            if j - i >= min_hold:
                for k in range(i + every, j, every):
                    out[k] = out[i]
            i = j
        else:
            i += 1
    return out


def drum_lines(hits: list[dict], n_steps: int, regular_hats: bool, section_bars: set[int] = frozenset()) -> tuple[list[str], list[str]]:
    kit = ["."] * n_steps
    hats = ["."] * n_steps
    prio = {"c": 3, "s": 2, "k": 1}
    for h in hits:
        s = h["step"]
        if s >= n_steps:
            continue
        d = GM_DRUMS.get(h["pitch"])
        if d in ("k", "s", "c"):
            if kit[s] == "." or prio[d] > prio[kit[s]]:
                kit[s] = d
        elif d in ("h", "o"):
            if hats[s] == "." or d == "o":
                hats[s] = d
    # a lone hit on an odd 16th (not part of a fill of 3+) is a flam or a mis-timed onset: move it to the 8th
    for s in range(1, n_steps, 2):
        if kit[s] != "." and not (kit[s - 1] != "." and (s + 1 < n_steps and kit[s + 1] != ".")):
            if kit[s - 1] == ".":
                kit[s - 1], kit[s] = kit[s], "."
            else:
                kit[s] = "."
    for b in section_bars:
        s = b * STEPS_PER_BAR
        if s < n_steps and any(t != "." for t in kit[s:s + STEPS_PER_BAR]):
            kit[s] = "c"
    if regular_hats:
        for bar in range(n_steps // STEPS_PER_BAR):
            a = bar * STEPS_PER_BAR
            seg = kit[a:a + STEPS_PER_BAR]
            if sum(1 for t in seg if t != ".") >= 2:
                for j in range(a, a + STEPS_PER_BAR, 2):
                    if hats[j] == ".":
                        hats[j] = "h"
    return kit, hats


ROCK = list("k...s...k...s...")
DBEAT = list("k.k.s...k.k.s...")


def regular_kit(kit: list[str], section_bars: set[int]) -> list[str]:
    """Replace each bar's kick/snare with a canonical punk pattern chosen by its hit density
    (d-beat for 6+ hits, straight rock otherwise), keeping fills (3+ snares in a row), empty bars and
    crashes. For loose, non-click drummers whose hits do not quantize cleanly."""
    out = list(kit)
    n_bars = len(kit) // STEPS_PER_BAR
    for b in range(n_bars):
        a = b * STEPS_PER_BAR
        bar = kit[a:a + STEPS_PER_BAR]
        hits = sum(1 for t in bar if t in ("k", "s", "c"))
        snares = "".join("s" if t == "s" else "." for t in bar)
        if "sss" in snares or hits < 1:
            continue
        pat = DBEAT if hits >= 6 else ROCK
        for j, t in enumerate(pat):
            out[a + j] = t
        if bar[0] == "c" or b in section_bars:
            out[a] = "c"
    return out


# ---------------------------------------------------------------------------
# song assembly
# ---------------------------------------------------------------------------

def note_name(p: int) -> str:
    return f"{NOTE_NAMES[p % 12]}{p // 12 - 1}"


def tokens_for_bar(line: list, bar: int, melodic: bool) -> str:
    toks = []
    for i in range(bar * STEPS_PER_BAR, (bar + 1) * STEPS_PER_BAR):
        v = line[i]
        if melodic:
            if v is None:
                toks.append(".")
            elif v == -1:
                toks.append("=")
            else:
                toks.append(note_name(v))
        else:
            toks.append(v)
    # a bar that starts with a hold needs the note restated (patterns are independent units in the file,
    # but '=' across bars is legal; keep it legal and readable)
    return " ".join(toks[:8]) + " | " + " ".join(toks[8:])


def bar_has_content(tok: str) -> bool:
    return any(t not in (".", "=", "|") for t in tok.split())


def parse_ranges(spec: str) -> list[int]:
    bars = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-")
            bars.extend(range(int(a), int(b) + 1))
        else:
            bars.append(int(part))
    return bars


def choose_bars(sections: list[dict], first: int, last: int, max_bars: int, busy: set[int] = frozenset()) -> tuple[list[int], list[str]]:
    """Section-aware pick: keep the song's section order, collapse adjacent repeats of a label, skip
    sections where the kit plays in under half the bars (intros, outros), trim each section to a
    multiple of 4 bars, stop at max_bars. Falls back to the first max_bars bars."""
    if not sections:
        bars = list(range(first, min(last + 1, first + max_bars)))
        return bars, ["?"] * len(bars)
    chosen, labels = [], []
    prev_label = None
    for s in sections:
        a, n = s["bar"], s["bars"]
        if a + n <= first or a > last:
            continue
        a = max(a, first)
        n = min(n, last + 1 - a)
        if busy and sum(1 for b in range(a, a + n) if b in busy) < n * 0.5:
            continue  # the kit is not playing: an intro, a breakdown or the outro
        if s["label"] == prev_label:
            continue  # the same section again (verse 2) — the loop covers it
        n = max(4, (n // 4) * 4) if n >= 4 else n
        if len(chosen) + n > max_bars:
            n = max_bars - len(chosen)
            n = (n // 4) * 4
            if n <= 0:
                break
        chosen.extend(range(a, a + n))
        labels.extend([s["label"]] * n)
        prev_label = s["label"]
        if len(chosen) >= max_bars:
            break
    if not chosen:
        bars = list(range(first, min(last + 1, first + max_bars)))
        return bars, ["?"] * len(bars)
    return chosen, labels


def js_string(s: str) -> str:
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def build_song(args: argparse.Namespace) -> tuple[str, dict]:
    midi_path = Path(args.midi).resolve()
    mid = read_midi(midi_path)
    tps = mid["division"] // 4  # ticks per 16th
    info = {}
    jp = midi_path.with_suffix(".json")
    if jp.exists():
        info = json.loads(jp.read_text())
    tracks = {t["name"].lower(): t for t in mid["tracks"]}
    find = lambda key: next((t for n, t in tracks.items() if key in n), {"notes": []})  # noqa: E731
    vocals = to_steps(find("vocal")["notes"], tps)
    guitar = to_steps(find("guitar")["notes"], tps)
    bass = to_steps(find("bass")["notes"], tps)
    drums = to_steps(find("drum")["notes"], tps)
    all_notes = vocals + guitar + bass + drums
    if not all_notes:
        sys.exit("no notes in the MIDI")
    n_steps = (max(n["step"] + n["len"] for n in all_notes) // STEPS_PER_BAR + 1) * STEPS_PER_BAR
    n_bars = n_steps // STEPS_PER_BAR

    # tempo: the JSON's median BPM (rounded) or the first set_tempo
    bpm = args.bpm or info.get("bpm")
    if not bpm:
        tempos = [t for tr in mid["tracks"] for t in tr["tempos"]]
        bpm = tempos[0][1] if tempos else 170
    bpm = int(round(bpm))

    # --- lines -----------------------------------------------------------------
    lead_oct = args.lead_octave
    roots_from = args.roots_from
    if roots_from == "auto":
        roots_from = "bass" if len(bass) > len(guitar) * 1.1 else "guitar"
    roots = chord_roots(bass if roots_from == "bass" else guitar, n_steps)
    roots_src = f"chord roots from the {roots_from} stem"
    instrumental = len(vocals) < max(8, n_bars // 4)
    if instrumental:
        lead = mono_line(guitar, n_steps, 64, 88, octave_shift=lead_oct, min_vel_frac=0.5, pick="high", unit=4)
        lead_src = "guitar top voice per beat (no vocal in the transcription)"
    else:
        lead = mono_line(vocals, n_steps, 60, 86, octave_shift=lead_oct, min_vel_frac=0.3, unit=2)
        lead_src = "vocals"
    riff = riff_from_roots(roots, 52, 63, drive=not args.no_drive)
    agree = bass_agrees(bass, roots)
    bass_notes = len(bass)
    if roots_from == "bass" or (bass_notes >= n_bars * 1.5 and agree >= 0.5):
        tri = mono_line(bass, n_steps, 40, 59, pick="low", min_vel_frac=0.25, unit=2)
        tri = retrigger(tri, 2, 4)
        tri_src = f"bass stem ({bass_notes} notes, {agree:.0%} on the chord root)"
    else:
        tri = bass_from_roots(roots, 40, 51)
        tri_src = f"chord roots an octave down (bass stem: {bass_notes} notes, {agree:.0%} on the chord root)"
    tri = fill_short_rests(tri, 8)
    section_bars = {s["bar"] for s in info.get("sections", [])}
    kit, hats = drum_lines(drums, n_steps, not args.no_regular_hats, section_bars)
    if args.kit == "regular":
        kit = regular_kit(kit, section_bars)
    lead_vocal_only = list(lead)
    filled_bars: set[int] = set()
    if args.fill_lead == "riff" and not instrumental:
        # a bar with no vocal: pulse1 doubles the riff an octave up (the chip version of a guitar overdub)
        for b in range(n_bars):
            a = b * STEPS_PER_BAR
            if all(v in (None, -1) for v in lead[a:a + STEPS_PER_BAR]) and any(v not in (None, -1) for v in riff[a:a + STEPS_PER_BAR]):
                for j in range(a, a + STEPS_PER_BAR):
                    lead[j] = None if riff[j] is None else (-1 if riff[j] == -1 else fold(riff[j] + 12, 64, 79))
                filled_bars.add(b)

    # --- bars with content ----------------------------------------------------------
    bar_tok = {}
    for b in range(n_bars):
        bar_tok[b] = {
            "pulse1": tokens_for_bar(lead, b, True), "pulse2": tokens_for_bar(riff, b, True),
            "tri": tokens_for_bar(tri, b, True), "noise": tokens_for_bar(kit, b, False), "hats": tokens_for_bar(hats, b, False),
        }
    active = [b for b in range(n_bars) if any(bar_has_content(bar_tok[b][c]) for c in ("pulse2", "tri", "noise"))]
    if not active:
        sys.exit("nothing to arrange")
    first, last = active[0], active[-1]
    if args.bars:
        chosen = [b for b in parse_ranges(args.bars) if 0 <= b < n_bars]
        labels = ["*"] * len(chosen)
    elif args.all:
        chosen = list(range(first, last + 1))
        labels = ["*"] * len(chosen)
    else:
        busy = {b for b in range(n_bars) if sum(1 for t in kit[b * STEPS_PER_BAR:(b + 1) * STEPS_PER_BAR] + hats[b * STEPS_PER_BAR:(b + 1) * STEPS_PER_BAR] if t != ".") >= 3}
        chosen, labels = choose_bars(info.get("sections", []), first, last, args.max_bars, busy)
    # a bar starting with '=' on a channel is fine for the engine only when the previous bar in `order`
    # sounded that note; restate the note at the bar line instead so patterns stay self-contained.
    def restate(line, b):
        i = b * STEPS_PER_BAR
        if 0 <= i < len(line) and line[i] == -1:
            j = i
            while j > 0 and line[j] == -1:
                j -= 1
            if line[j] not in (None, -1):
                line[i] = line[j]
    for b in chosen:
        for line in (lead, riff, tri):
            restate(line, b)
        bar_tok[b] = {
            "pulse1": tokens_for_bar(lead, b, True), "pulse2": tokens_for_bar(riff, b, True),
            "tri": tokens_for_bar(tri, b, True), "noise": tokens_for_bar(kit, b, False), "hats": tokens_for_bar(hats, b, False),
        }

    # --- patterns (dedupe) ----------------------------------------------------------
    prefix = {"pulse1": "V", "pulse2": "R", "tri": "B", "noise": "D", "hats": "H"}
    patterns: dict[str, dict[str, str]] = {c: {} for c in prefix}
    names: dict[str, dict[str, str]] = {c: {} for c in prefix}
    order = []
    for b, lab in zip(chosen, labels):
        entry = {}
        for c in prefix:
            tok = bar_tok[b][c]
            if not bar_has_content(tok):
                continue
            if tok not in names[c]:
                nm = f"{prefix[c]}{len(names[c]) + 1}"
                names[c][tok] = nm
                patterns[c][nm] = tok
            entry[c] = names[c][tok]
        order.append((b, lab, entry))
    use_hats = bool(patterns["hats"])
    n_filled = sum(1 for b in chosen if b in filled_bars)
    if n_filled:
        lead_src += f"; riff an octave up in the {n_filled} of {len(chosen)} bars without a vocal"
    loop_start = args.loop_start if args.loop_start is not None else 0

    # --- main riff: the most repeated 2-bar guitar root sequence ---------------------------
    seqs = Counter()
    for b in range(first, last):
        key = (bar_tok[b]["pulse2"], bar_tok[b + 1]["pulse2"])
        if bar_has_content(key[0]):
            seqs[key] += 1
    main_riff = seqs.most_common(1)[0] if seqs else None

    # --- emit ------------------------------------------------------------------------
    title = args.title or info.get("name", midi_path.stem).replace("_", " ").title()
    key = info.get("key", "?")
    sec_txt = " ".join(f"{s['label']}@{s['bar']}x{s['bars']}" for s in info.get("sections", [])) or "none detected"
    used = []
    run_start, run_lab, run_len = None, None, 0
    for b, lab, _ in order + [(None, None, None)]:
        if run_lab == lab and b is not None and b == run_start + run_len:
            run_len += 1
            continue
        if run_start is not None:
            used.append(f"{run_lab}: bars {run_start}-{run_start + run_len - 1}")
        run_start, run_lab, run_len = b, lab, 1
    header = [
        f"/**",
        f" * {args.id} — \"{title}\" (band cover; a chiptune arrangement of the demo recording).",
        f" * Draft generated by tools/midi_to_song.py from {midi_path.relative_to(Path.cwd()) if midi_path.is_relative_to(Path.cwd()) else midi_path.name},",
        f" * then hand-tuned. Transcription: {bpm} BPM, key {key}, {info.get('duration_s', '?')} s, sections {sec_txt}.",
        f" * pulse1 = {lead_src}; pulse2 = riff ({roots_src}, 8th downstrokes with the fifth); tri = {tri_src};",
        f" * noise = kit, hats = closed/open hats. Arrangement ({len(order)} bars): {'; '.join(used)}.",
    ]
    if main_riff:
        header.append(f" * Main riff (most repeated 2 bars of guitar, {main_riff[1]}x): {main_riff[0][0]} / {main_riff[0][1]}")
    header.append(" */")
    lines = header + [
        "export default {",
        f"  id: {js_string(args.id)},",
        f"  title: {js_string(title)},",
        f"  bpm: {bpm},",
        "  beatsPerBar: 4,",
        "  stepsPerBeat: 4,",
        "  loop: true,",
    ]
    if loop_start:
        lines.append(f"  loopStart: {loop_start},")
    lines.append("  channels: {")
    chan_cfg = {
        "pulse1": "wave: 'pulse', duty: 0.5, volume: 0.3,\n      env: { attack: 0.003, decay: 0.05, sustain: 0.8, release: 0.04 },\n      vibrato: { rate: 5.5, depth: 16, delay: 0.12 },",
        "pulse2": "wave: 'pulse', duty: 0.25, volume: 0.22,\n      env: { attack: 0.002, decay: 0.03, sustain: 0.85, release: 0.02 },",
        "tri": "wave: 'triangle', volume: 0.55,\n      env: { attack: 0.002, decay: 0.02, sustain: 0.9, release: 0.02 },",
        "noise": "wave: 'noise', volume: 0.36,",
        "hats": "wave: 'noise', volume: 0.18,",
    }
    for c in ("pulse1", "pulse2", "tri", "noise", "hats"):
        if c == "hats" and not use_hats:
            continue
        if not patterns[c]:
            continue
        lines.append(f"    {c}: {{")
        lines.append(f"      {chan_cfg[c]}")
        lines.append("      patterns: {")
        for nm, tok in patterns[c].items():
            lines.append(f"        {nm}: {js_string(tok)},")
        lines.append("      },")
        lines.append("    },")
    lines.append("  },")
    lines.append("  order: [")
    for b, lab, entry in order:
        body = ", ".join(f"{c}: {js_string(entry[c])}" for c in ("pulse1", "pulse2", "tri", "noise", "hats") if c in entry)
        lines.append(f"    {{ {body} }}, // bar {b} ({lab})")
    lines.append("  ],")
    lines.append("};")
    # --- fidelity of the reduction against the transcription, over the chosen bars ----------------
    chosen_set = set(chosen)
    in_chosen = lambda n: (n["step"] // STEPS_PER_BAR) in chosen_set  # noqa: E731
    def coverage(src, line, unit, same_pc=True):
        src = [n for n in src if in_chosen(n)]
        if not src:
            return None
        vmax = max(n["vel"] for n in src)
        strong = [n for n in src if n["vel"] >= vmax * 0.3]
        hit = 0
        for n in strong:
            s0 = (n["step"] // unit) * unit
            v = line[s0] if s0 < len(line) else None
            if v == -1:  # the slot is a hold: find the note being held
                j = s0
                while j > 0 and line[j] == -1:
                    j -= 1
                v = line[j]
            if v is not None and v != -1 and (not same_pc or v % 12 == n["pitch"] % 12):
                hit += 1
        return round(hit / len(strong), 2)
    def root_agreement():
        src = [n for n in guitar if in_chosen(n)]
        if not src:
            return None
        ok = tot = 0
        for n in src:
            r = roots[n["step"] // 4] if n["step"] // 4 < len(roots) else None
            if r is None:
                continue
            tot += 1
            if n["pitch"] % 12 in (r % 12, (r + 7) % 12, (r + 12) % 12):
                ok += 1
        return round(ok / tot, 2) if tot else None
    def drum_agreement():
        src = [h for h in drums if in_chosen(h) and GM_DRUMS.get(h["pitch"]) in ("k", "s")]
        if not src:
            return None
        hit = sum(1 for h in src if kit[h["step"]] == GM_DRUMS.get(h["pitch"]) or (kit[h["step"]] == "c"))
        return round(hit / len(src), 2)
    def pc_hist(line):
        h = [0.0] * 12
        for v in line:
            if v not in (None, -1):
                h[v % 12] += 1
        t = sum(h) or 1
        return [x / t for x in h]
    def pc_hist_notes(notes):
        h = [0.0] * 12
        for n in notes:
            if in_chosen(n):
                h[n["pitch"] % 12] += n["len"]
        t = sum(h) or 1
        return [x / t for x in h]
    def cosine(a, b):
        num = sum(x * y for x, y in zip(a, b)); da = sum(x * x for x in a) ** 0.5; db = sum(y * y for y in b) ** 0.5
        return round(num / (da * db), 2) if da and db else None
    fidelity = {
        "lead_onsets_reproduced": coverage(vocals if not instrumental else guitar, lead, 2 if not instrumental else 4),
        "guitar_notes_on_root_or_fifth": root_agreement(),
        "kick_snare_hits_kept": drum_agreement(),
        "lead_vs_vocals_pitch_class_cosine": cosine(pc_hist(lead_vocal_only), pc_hist_notes(vocals)) if not instrumental else None,
        "riff_vs_guitar_pitch_class_cosine": cosine(pc_hist(riff), pc_hist_notes(guitar)),
        "tri_vs_bass_pitch_class_cosine": cosine(pc_hist(tri), pc_hist_notes(bass)) if bass else None,
    }
    summary = {
        "fidelity": fidelity,
        "id": args.id, "bpm": bpm, "key": key, "bars": len(order), "source_bars": [first, last], "chosen": used,
        "patterns": {c: len(p) for c, p in patterns.items()}, "lead": lead_src, "tri": tri_src,
        "lead_notes": sum(1 for v in lead if v not in (None, -1)), "riff_notes": sum(1 for v in riff if v not in (None, -1)), "bass_agreement": round(agree, 2),
        "instrumental": instrumental, "main_riff": main_riff[0] if main_riff else None,
    }
    return "\n".join(lines) + "\n", summary


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("midi")
    ap.add_argument("--id", required=True, help="song id (e.g. band_hunger)")
    ap.add_argument("--title")
    ap.add_argument("--out", help="song file to write (default: stdout)")
    ap.add_argument("--bars", help="explicit bar ranges from the transcription, e.g. 8-23,40-55")
    ap.add_argument("--all", action="store_true", help="every bar with content (long)")
    ap.add_argument("--max-bars", type=int, default=64)
    ap.add_argument("--bpm", type=float)
    ap.add_argument("--lead-octave", type=int, default=1, help="octaves to shift the lead up (default 1: a sung line sits an octave higher as a chip lead)")
    ap.add_argument("--no-drive", action="store_true", help="no 8th-note root/fifth drive on held guitar chords")
    ap.add_argument("--no-regular-hats", action="store_true")
    ap.add_argument("--loop-start", type=int)
    ap.add_argument("--fill-lead", choices=["riff", "none"], default="riff", help="what pulse1 plays in bars with no vocal (default: the riff an octave up)")
    ap.add_argument("--roots-from", choices=["auto", "guitar", "bass"], default="auto", help="which stem gives the chord roots (auto: the bass when it has more notes than the guitar)")
    ap.add_argument("--kit", choices=["detected", "regular"], default="detected", help="regular: canonical rock/d-beat kick-snare per bar by hit density (for loose drummers)")
    ap.add_argument("--print-summary", action="store_true")
    args = ap.parse_args()
    js, summary = build_song(args)
    if args.out:
        Path(args.out).write_text(js)
    else:
        sys.stdout.write(js)
    if args.print_summary or args.out:
        print(json.dumps(summary), file=sys.stderr)


if __name__ == "__main__":
    main()
