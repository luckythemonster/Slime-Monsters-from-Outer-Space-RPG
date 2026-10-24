// Scripted battles (docs/DESIGN.md "Scripted battles, hook by hook"), keyed by encounter `script`.
// Each entry is a factory returning a fresh hooks object so a battle can be replayed:
//   { onStart(m), onRound(m, n), onTurnStart(m, actor), onAction(m, actor, action), onToon(m, level),
//     onHpBelow(m, who, pct), onDefeat(m, who), onLeave(m, who, how), onWipe(m), hpBelow: [{ who, pct }] }
// Hooks mutate the model through its API (text/say/caption/toast/join/spawn/transform/inflict/damage/
// setMeter/lockInput/leave/revive/finish/forceNoise/wait) and may also return extra presentation events.
// Pure module: no Phaser.

const CAP = (m, text) => m.caption(text);

/** B-1 `alley_drone` — tutorial. Lucky alone; Phoenix joins on round 2. */
function ep0_drone() {
  let colorToast = false;
  return {
    hpBelow: [{ who: 'drone', pct: 50 }],
    onStart(m) {
      m.text('A Vanguard Retrieval Drone followed the pod.');
      m.toast('STRUM to attack. Hits put AMP in the tank.');
      m.allowCommands(['strum', 'tune']);
    },
    onRound(m, n) {
      if (n !== 2) return;
      m.allowCommands(null);
      if (!m.find('phoenix')) m.join(m.data.makeSeed('phoenix'));
      m.say('phoenix', 'Beats the day job.');
      m.toast('RIFF spends AMP. Power Chord costs 3. Shared Aura is a SYNC.');
    },
    onTurnStart(m, actor) {
      const lucky = m.find('lucky');
      if (!colorToast && lucky && lucky.hp < lucky.maxHp && m.find('phoenix') && actor.id === 'lucky') {
        colorToast = true;
        m.toast("Phoenix: Your color's doing a thing.");
      }
    },
    onHpBelow(m, who) {
      if (who !== 'drone') return;
      m.text('RETRIEVAL TARGET IS NONCOMPLIANT.');
      m.toast('The TOON meter is filling. At 25 you can make NOISE.');
    },
    onDefeat(m, who) {
      if (who !== 'drone') return;
      m.text('It leaves a $2 severance check.');
      m.flags.tutorialDone = true;
    },
  };
}

/** B-9 `ep0_audition` — survive seven rounds while Possessed Ryan does the killing. */
function ep0_audition() {
  return {
    onStart(m) {
      m.text('One, two, three, four!');
      m.emit({ type: 'anim', who: 'ryan', key: 'drum' });
      m.transform('ryan', { form: 'possessed' });
      m.emit({ type: 'shake', ms: 600, px: 4 });
      m.emit({ type: 'uiTear', level: 1 });
      CAP(m, '[Well. I guess my arms belong to the goo now.]');
      m.flags.auditionStarted = true;
    },
    onRound(m, n) {
      if (n === 3) CAP(m, "[Tempo's good, though. Very steady.]");
      if (n === 5) CAP(m, '[Ride cymbal sounds a bit tinny. Should probably buy a new one if I survive this.]');
      if (n === 7) {
        m.text('The song crashes to a halt.');
        m.emit({ type: 'music', id: null });
        m.emit({ type: 'sfx', name: 'cymbal' });
        m.flags.auditionWon = true;
        m.finish('win');
      }
    },
    onDefeat(m, who) {
      const c = m.find(who);
      if (c && c.side === 'enemy' && m.living('enemy').length === 0) m.flags.auditionWon = true;
    },
  };
}

/** B-10 `ep0_rehearsal` — The Chorus: a pacing scene that ends on KRAAANG (cannot be lost). */
function ep0_rehearsal() {
  let done = false;
  const finale = (m) => {
    if (done) return;
    done = true;
    m.suspendEnd = true;
    m.emit({ type: 'anim', who: 'word', key: 'kraaang_swing' });
    m.emit({ type: 'shake', ms: 300, px: 2 });
    const brian = m.find('brian');
    if (brian) {
      m.damage(brian, 1, { scripted: true, source: 'script' });
      m.text("The G knocks over Brian's boutique iced coffee.");
      m.transform('brian', { sheet: (brian.altSheets && brian.altSheets.fried) || 'brian_fried' });
      m.inflict(brian, 'OUT_OF_TUNE', 3);
      m.text('Sparks.');
      m.emit({ type: 'sfx', name: 'feedback' });
      m.say('brian', "I can't work like this! I hate this weird, creative shit! Can't we just play normal music?!", { portrait: 'brian_red' });
    }
    // Cannot be lost: whoever the wipe (or the possessed Ryan) put down stands back up at 1 HP, so the
    // rehearsal never hands THE SET a band that is already out.
    for (const c of m.party()) if (c.ko && c.controllable && !c.auto) m.revive(c, 1);
    m.flags.kraaangFired = true;
    m.flags.brianFried = true;
    m.suspendEnd = false;
    m.finish('win');
  };
  const forced = (m) => {
    if (done) return;
    m.text("Lucky and Phoenix's slime links up on its own.");
    m.forceNoise('kraaang', 'lucky');
    finale(m);
  };
  return {
    onStart(m) {
      m.transform('ryan', { form: 'possessed' });
      m.toast('Hit the chorus. Get to Toon 2.');
    },
    onAction(m, actor, action) {
      if (action.cmd === 'noise' && action.word === 'kraaang') finale(m);
    },
    onRound(m, n) {
      if (n === 8) forced(m);
    },
    onWipe(m) { forced(m); },
  };
}

/**
 * B-11 `ep0_palmers_set` — THE SET: cops, backup, Pocket Ryan, the one choice Ryan gets all game, then The Eternity.
 * Toon 3 / round 6 / the last cop gone, whichever comes first, puts the question: [Keep fighting it] / [Let go].
 * From the question on the fight cannot be lost (HP floors at 1) and the end check waits on the answer. [Let go]
 * arms at once and Ryan's next turn levels the bar. [Keep fighting it] holds the possession for two of Ryan's
 * turns ("[Holding it.]", "[Holding it. Holding it.]") while the walls keep fighting, then his third turn gives up
 * ("[I couldn't.]") and fires anyway: the choice is about complicity, not outcome. The set remembers it as
 * `flags.eternityChoice` ('letGo' | 'keptFighting', the story bible's name) and `flags.letGo` (the same answer as
 * a boolean for script conditions); CS-17's quit branches on it.
 */
function ep0_palmers_set() {
  let asked = false;
  let armed = false;
  let fired = false;
  let mohawk = false;
  let torn = false;
  let holding = false;
  let holdTurns = 0;
  const tear = (m) => {
    if (torn) return;
    torn = true;
    m.emit({ type: 'uiTear', level: 2 });
  };
  const arm = (m) => {
    if (armed || fired) return;
    armed = true;
    const ryan = m.find('ryan');
    const dark = (ryan && ryan.forms && ryan.forms.pocket && ryan.forms.pocket.armedSheet) || 'ryan_pocket_purple';
    m.transform('ryan', { form: 'pocket', sheet: dark });
    tear(m);
    m.lockInput(true);
    m.invincible = true;
    m.flags.eternityArmed = true;
  };
  const ask = (m) => {
    if (asked || fired) return;
    asked = true;
    m.invincible = true;
    CAP(m, "[I've been fighting the possession. That was a mistake.]");
    m.prompt(['[Keep fighting it]', '[Let go]'], (i) => {
      if (i === 1) {
        m.flags.letGo = true;
        m.flags.eternityChoice = 'letGo';
        arm(m);
        return;
      }
      m.flags.letGo = false;
      m.flags.eternityChoice = 'keptFighting';
      holding = true;
      tear(m);
      if (m.living('enemy').length === 0) m.lockInput(true); // nothing left to fight: the rounds tick on their own (until the raid)
    });
  };
  const eternity = (m, actor) => {
    fired = true;
    m.suspendEnd = true;
    m.setMeter(100, { force: true, source: 'script' });
    m.transform('ryan', { form: 'eternity' });
    CAP(m, '[I am not trapped in the goo. The goo is trapped in the pocket.]');
    m.emit({ type: 'music', id: 'eternity' });
    m.wait(900);
    m.forceNoise('doom', 'ryan', { flat: 999 });
    m.wait(900);
    m.forceNoise('crack', 'ryan');
    m.emit({ type: 'background', id: 'palmers_roof_peel' });
    m.text("The roof of Palmer's Bar peels back exactly like a sardine can.");
    m.wait(900);
    m.forceNoise('thud', 'ryan');
    m.emit({ type: 'shake', ms: 1200, px: 4 });
    m.text('The walls blow outward.');
    CAP(m, '[Rhythm achieved.]');
    m.flags.eternityFired = true;
    if (actor) actor.acted = true;
    m.suspendEnd = false;
    m.finish('win');
  };
  return {
    onStart(m) {
      m.transform('ryan', { form: 'pocket' });
      m.text('Dispatch, I have located the unauthorized slime gathering. Stand by.');
      const cop = m.find('cop');
      if (cop) m.inflict(cop, 'ON_HOLD', 2);
    },
    onAction(m, actor, action) {
      if (mohawk || fired || action.scripted || actor.side !== 'party' || actor.auto) return;
      // "The first power chord": the first attacking action by a controllable member (STRUM, a damaging RIFF, SYNC or NOISE).
      if (!['strum', 'sync', 'noise', 'riff'].includes(action.cmd)) return;
      if (action.cmd === 'riff' && !(m.moveFor(actor, action.riff) || {}).pow) return;
      mohawk = true;
      m.text("The first power chord blows the front row's hair back.");
      const cop = m.find('cop');
      if (cop) {
        m.emit({ type: 'anim', who: 'cop', key: 'mohawk_off' });
        m.transform('cop', { sheet: (cop.altSheets && cop.altSheets.nomohawk) || cop.sprite });
      }
      m.emit({ type: 'sfx', name: 'slime_pop' });
      m.text("It lands in a stranger's beer. The stranger says 'whoa, man.'");
      CAP(m, '[No obnoxious guitar solos. Just pure, unadulterated rhythm. The slime is pulsating in 7/8 time. I can work with this.]');
      m.flags.mohawkOff = true;
    },
    onRound(m, n) {
      if (n === 3 && !fired) {
        m.spawn('backup_cop');
        m.spawn('backup_cop');
        m.text('Backup. Also in leather jackets. Also with price tags.');
        if (holding && !armed && m.inputLocked) m.lockInput(false); // the raid arrives mid-hold: the command window comes back
      }
      if (n === 6) ask(m);
    },
    onToon(m, level) {
      if (level >= 3) ask(m);
    },
    onTurnStart(m, actor) {
      if (actor.id !== 'ryan' || fired) return;
      if (holding && !armed) {
        holdTurns += 1;
        if (holdTurns <= 2) {
          CAP(m, holdTurns === 1 ? '[Holding it.]' : '[Holding it. Holding it.]');
          if (m.living('enemy').length === 0) actor.acted = true; // nobody to drum at: the hold is the whole turn
          return;
        }
        CAP(m, "[I couldn't.]");
        arm(m);
      }
      if (armed) eternity(m, actor);
    },
    onDefeat(m, who) {
      const c = m.find(who);
      if (!c || c.side !== 'enemy' || fired) return;
      m.text(`${c.name} crawls toward the exit...`);
      m.leave(c, 'flee');
    },
    // The Eternity ends THE SET, never the cops leaving: when the last one crawls off (or a KRAAANG knocks it
    // off-panel) hold the win and put the question (or, mid-hold, let the rounds tick until it fires). Runs before
    // the model's end check, so the suspend lands in time.
    onLeave(m) {
      if (fired || m.living('enemy').length > 0) return;
      m.suspendEnd = true;
      if (holding) {
        if (!armed) m.lockInput(true);
        return;
      }
      ask(m);
    },
  };
}

export const BATTLE_SCRIPTS = { ep0_drone, ep0_audition, ep0_rehearsal, ep0_palmers_set };
export default BATTLE_SCRIPTS;
