// Debug/test API on window.__slime (ARCHITECTURE §9). Installed from main.js.
import Phaser from 'phaser';
import { services } from './services.js';

/** console.error + window errors captured from the moment captureErrors() runs. */
export const lastErrors = [];

let readyResolve;
const readyPromise = new Promise((resolve) => { readyResolve = resolve; });
let isReady = false;

/** Hook console.error / window.onerror / unhandledrejection (call before Phaser boots). */
export function captureErrors() {
  const orig = console.error.bind(console);
  console.error = (...args) => {
    lastErrors.push(args.map((a) => (a && a.stack) || String(a)).join(' '));
    orig(...args);
  };
  window.addEventListener('error', (ev) => lastErrors.push(`error: ${ev.message || ev}`));
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    lastErrors.push(`unhandledrejection: ${(r && (r.stack || r.message)) || String(r)}`);
  });
}

/** Called by TitleScene.create: resolves `__slime.ready` (and the smoke test's `__smoke`). */
export function markReady(scene) {
  if (isReady) return;
  isReady = true;
  const renderer = scene.sys.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas';
  const fontLoaded = typeof document.fonts?.check === 'function' ? document.fonts.check('8px "Press Start 2P"') : null;
  // tests/smoke.mjs (owned elsewhere) polls window.__smoke; keep it alongside __slime.
  window.__smoke = { ready: true, renderer, phaser: Phaser.VERSION, fontLoaded };
  readyResolve();
}

const SCENE_PRIORITY = ['GameOver', 'Freefall', 'Battle', 'Menu', 'Explore', 'Title', 'Boot'];

/**
 * @param {Phaser.Game} game
 */
export function installDebug(game) {
  const sm = game.scene;
  const explore = () => (sm.isActive('Explore') || sm.isSleeping('Explore') || sm.isPaused('Explore') ? sm.getScene('Explore') : null);
  const requireExplore = () => {
    const ex = explore();
    if (!ex) throw new Error('Explore scene is not running');
    return ex;
  };

  const steps = (n) => new Promise((resolve) => {
    let c = 0;
    const h = () => { if (++c >= n) { game.events.off(Phaser.Core.Events.POST_STEP, h); resolve(); } };
    game.events.on(Phaser.Core.Events.POST_STEP, h);
  });

  const waitFor = (predicate, timeoutMs = 5000) => new Promise((resolve, reject) => {
    let elapsed = 0;
    const h = (_t, delta) => {
      elapsed += delta;
      let ok = false;
      try { ok = !!predicate(); } catch { ok = false; }
      if (ok) { game.events.off(Phaser.Core.Events.POST_STEP, h); resolve(true); }
      else if (elapsed >= timeoutMs) { game.events.off(Phaser.Core.Events.POST_STEP, h); reject(new Error(`waitFor timed out after ${timeoutMs}ms`)); }
    };
    game.events.on(Phaser.Core.Events.POST_STEP, h);
  });

  /** Stop every gameplay scene and start Explore from the current GameState position. */
  const restartExplore = () => new Promise((resolve) => {
    if (services.ui) services.ui.closeAll();
    for (const k of SCENE_PRIORITY) {
      if (k !== 'Boot' && (sm.isActive(k) || sm.isPaused(k) || sm.isSleeping(k))) sm.stop(k);
    }
    const ex = sm.getScene('Explore');
    ex.events.once(Phaser.Scenes.Events.CREATE, () => resolve(api.snapshot()));
    sm.start('Explore');
    sm.bringToTop('UI');
  });

  const idle = () => {
    const ui = services.ui;
    if (ui && ui.isBusy()) return false;
    const ex = explore();
    if (!ex) return true;
    return !(ex.runner && ex.runner.running) && !ex.transitioning && !(ex.player && ex.player.moving) && ex.lockCount === 0;
  };

  const api = {
    ready: readyPromise,
    get isReady() { return isReady; },
    game,
    get state() { return services.state; },
    services,
    scene: () => SCENE_PRIORITY.find((k) => sm.isActive(k)) || null,
    explore,
    idle,
    waitIdle: (timeoutMs = 5000) => waitFor(idle, timeoutMs),

    async newGame() { services.state.newGame(); return restartExplore(); },
    async load(slot = 1) {
      if (!services.state.load(slot)) throw new Error(`no save in slot ${slot}`);
      return restartExplore();
    },
    save(slot = 1) { return services.state.save(slot); },

    warp(mapId, x, y, facing) { return requireExplore().changeMap(mapId, x, y, facing); },
    setFlag(path, value = true) {
      services.state.set(path.includes('.') ? path : `flags.${path}`, value);
      const ex = explore();
      if (ex) ex.refreshConditions();
    },
    give(itemId, qty = 1) { return services.state.inventory.add(itemId, qty); },
    setMoney(n) { services.state.money = Math.max(0, n); return services.state.money; },
    addParty(id) { return services.state.party.add(id); },
    removeParty(id) { return services.state.party.remove(id); },

    startBattle(encounterId) { return requireExplore().startBattle(encounterId); },
    runScript(scriptId) { return requireExplore().runner.run(scriptId); },

    async press(action) {
      services.input.simulate(action);
      await steps(2);
      await waitFor(() => { const ex = explore(); return !ex || !ex.player || !ex.player.moving; }, 3000);
    },
    hold(action, ms) { return services.input.hold(action, ms); },
    textInstant(v) { if (services.ui) services.ui.setTextInstant(v); },
    autoAdvance(v) { if (services.ui) services.ui.setAutoAdvance(v); },
    get chooseIndex() { return services.ui ? services.ui.chooseIndex : 0; },
    set chooseIndex(v) { if (services.ui) services.ui.chooseIndex = v; },
    waitFor,
    steps,
    snapshot() {
      const snap = services.state ? services.state.snapshot() : {};
      snap.scene = api.scene();
      const ex = explore();
      if (ex && ex.player) {
        snap.entities = [...ex.entities.values()].map((e) => ({ id: e.id, type: e.type, x: e.tileX, y: e.tileY, facing: e.facing, behavior: e.behavior }));
      }
      return snap;
    },
    lastErrors,
  };

  window.__slime = api;
  return api;
}
