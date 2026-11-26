// ============================================================================
//  Entrées : Gamepad API (mapping "standard" Xbox / PlayStation) + clavier.
//  Produit un état unifié : move, aim (vecteurs -1..1), held/pressed par ACTION,
//  et des évènements de navigation menu.
//
//  Actions de frappe (identifiants internes) :
//    A = coup droit / revers / volée   X = coupé / amortie
//    Y = smash / bandeja               B = lob
//  Chaque action est associée à un bouton de la manette (configurable) :
//    - "Boutons"   : A / X / Y / B (faces)
//    - "Gâchettes" : RT / LB / RB / LT (le pouce droit reste sur le stick de visée)
//    - "Personnalisée" : réassignation bouton par bouton depuis le menu Contrôles.
//
//  Clavier (positions physiques : ZQSD en AZERTY = WASD en QWERTY) :
//   déplacement ZQSD · visée flèches · K=A  J=X  I=Y  L=B · Espace = A · Échap = pause
// ============================================================================
export const ACTIONS = [
  { id: 'A', label: 'Coup droit / revers / volée' },
  { id: 'X', label: 'Coupé (stick bas = amortie)' },
  { id: 'Y', label: 'Smash / bandeja' },
  { id: 'B', label: 'Lob' },
];

// index des boutons du mapping "standard" de la Gamepad API
export const PRESETS = {
  face: { label: 'Boutons (A B X Y)', map: { A: 0, X: 2, Y: 3, B: 1 } },
  triggers: { label: 'Gâchettes (RT LB RB LT)', map: { A: 7, X: 4, Y: 5, B: 6 } },
};
const ASSIGNABLE = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11];
const PAD_NAMES = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3'],
};
PAD_NAMES.generic = PAD_NAMES.xbox;

const START_BTN = 9;
const KEYMAP = {
  A: ['KeyK', 'Space'],
  B: ['KeyL'],
  X: ['KeyJ'],
  Y: ['KeyI'],
  START: ['Escape', 'KeyP'],
  VIEW: ['KeyC'],
  SPRINT: ['ShiftLeft', 'ShiftRight'],
  HELP: ['KeyH'],
  TACTIC: ['KeyT'],
};
const HELP_BTN = 11;         // clic du stick droit : afficher / masquer les aides
const SPRINT_BTN = 10;       // clic du stick gauche : petit sprint
const VIEW_BTN = 8;          // View / Select / Share : changer de caméra
const COMBO_KEY = 'KeyU';    // contre-vitre au clavier
const GAME_KEYS = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyO', 'KeyH', 'KeyT', 'KeyC', 'Enter', 'Escape', 'ShiftLeft', 'ShiftRight',
]);
const STORAGE_KEY = 'padel-arena.controls';
const TRIGGER_THRESHOLD = 0.35;

function deadzone(x, y, d = 0.18) {
  const m = Math.hypot(x, y);
  if (m < d) return { x: 0, y: 0 };
  const k = Math.min(1, (m - d) / (1 - d)) / m;
  return { x: x * k, y: y * k };
}

/** Bouton enfoncé (les gâchettes LT/RT sont analogiques : on prend leur valeur). */
const isDown = (b) => !!b && (b.pressed || b.value > TRIGGER_THRESHOLD);

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.padId = null;
    this.padType = 'keyboard'; // 'xbox' | 'playstation' | 'generic' | 'keyboard'
    this.lastPadIndex = null;
    this.move = { x: 0, y: 0 };
    this.aim = { x: 0, y: 0 };
    this.held = {};
    this.pressed = {};
    this.menu = { up: false, down: false, left: false, right: false, confirm: false, back: false };
    this._prev = {};
    this._prevMenu = {};
    this._prevPad = [];
    this.capture = null;       // réassignation en cours : callback(index | null)
    this.version = 0;          // change quand la configuration change (pour rafraîchir l'aide)
    this.preset = 'face';
    this.mapping = { ...PRESETS.face.map };
    this.load();

    addEventListener('keydown', (e) => {
      // pendant la saisie d'un texte (nom du joueur), le clavier n'agit pas sur le jeu
      if (e.target.closest?.('input,textarea')) { if (e.code === 'Enter' || e.code === 'Escape') e.target.blur(); return; }
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('gamepadconnected', (e) => { this.lastPadIndex = e.gamepad.index; });
    addEventListener('gamepaddisconnected', (e) => {
      if (this.lastPadIndex === e.gamepad.index) this.lastPadIndex = null;
    });
  }

  // ------------------------------------------------------------ configuration
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (s && s.mapping && ACTIONS.every((a) => Number.isInteger(s.mapping[a.id]))) {
        this.mapping = { ...s.mapping };
        this.preset = s.preset || 'custom';
      }
    } catch { /* stockage indisponible : configuration par défaut */ }
  }

  save() {
    this.version++;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset: this.preset, mapping: this.mapping })); } catch { /* ignoré */ }
  }

  /** Bouton des consignes au partenaire : RB, ou Y si RB sert déjà à frapper (mode gâchettes). */
  tacticButton() { return Object.values(this.mapping).includes(5) ? 3 : 5; }

  setPreset(name) {
    if (!PRESETS[name]) return;
    this.preset = name;
    this.mapping = { ...PRESETS[name].map };
    this.save();
  }

  /** Associe un bouton à une action ; si le bouton servait déjà, les deux sont échangés. */
  assign(action, index) {
    const other = Object.keys(this.mapping).find((k) => this.mapping[k] === index && k !== action);
    if (other) this.mapping[other] = this.mapping[action];
    this.mapping[action] = index;
    const match = Object.entries(PRESETS).find(([, p]) => ACTIONS.every((a) => p.map[a.id] === this.mapping[a.id]));
    this.preset = match ? match[0] : 'custom';
    this.save();
  }

  /** Attend le prochain bouton pressé (réassignation). cb(null) si annulé. */
  startCapture(cb) {
    this.capture = cb;
    const pad = this.getPad();
    this._prevPad = pad ? pad.buttons.map(isDown) : [];
  }

  // ------------------------------------------------------------ lecture
  getPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (!pads) return null;
    if (this.lastPadIndex != null && pads[this.lastPadIndex]?.connected) return pads[this.lastPadIndex];
    for (const p of pads) if (p && p.connected) { this.lastPadIndex = p.index; return p; }
    return null;
  }

  static detectType(id = '') {
    if (/xbox|xinput|045e/i.test(id)) return 'xbox';
    if (/playstation|dualshock|dualsense|wireless controller|054c/i.test(id)) return 'playstation';
    return 'generic';
  }

  poll() {
    const k = this.keys;
    const pad = this.getPad();
    if (pad) {
      if (pad.id !== this.padId) { this.padId = pad.id; this.padType = InputManager.detectType(pad.id); this.version++; }
    } else if (this.padType !== 'keyboard') { this.padId = null; this.padType = 'keyboard'; this.version++; }

    // --- réassignation : on intercepte tout jusqu'au prochain bouton
    if (this.capture) {
      const cb = this.capture;
      if (k.has('Escape')) { this.capture = null; this.keys.delete('Escape'); cb(null); }
      else if (pad) {
        const now = pad.buttons.map(isDown);
        const idx = ASSIGNABLE.find((i) => now[i] && !this._prevPad[i]);
        this._prevPad = now;
        if (idx !== undefined) { this.capture = null; cb(idx); }
      }
      for (const key in this.menu) this.menu[key] = false;
      for (const key in this.pressed) this.pressed[key] = false;
      // on mémorise l'état courant pour ne pas déclencher de front montant à la sortie
      this._syncPrev(pad);
      return;
    }

    // --- sticks
    let mx = 0, my = 0, ax = 0, ay = 0;
    if (k.has('KeyA')) mx -= 1;
    if (k.has('KeyD')) mx += 1;
    if (k.has('KeyW')) my += 1;
    if (k.has('KeyS')) my -= 1;
    if (k.has('ArrowLeft')) ax -= 1;
    if (k.has('ArrowRight')) ax += 1;
    if (k.has('ArrowUp')) ay += 1;
    if (k.has('ArrowDown')) ay -= 1;
    const kl = Math.hypot(mx, my); if (kl > 1) { mx /= kl; my /= kl; }
    const al = Math.hypot(ax, ay); if (al > 1) { ax /= al; ay /= al; }

    if (pad) {
      const l = deadzone(pad.axes[0] || 0, -(pad.axes[1] || 0));
      const r = deadzone(pad.axes[2] || 0, -(pad.axes[3] || 0), 0.22);
      if (l.x || l.y) { mx = l.x; my = l.y; }
      if (r.x || r.y) { ax = r.x; ay = r.y; }
      const b = pad.buttons;
      if (b[12]?.pressed || b[13]?.pressed || b[14]?.pressed || b[15]?.pressed) {
        mx = (b[15]?.pressed ? 1 : 0) - (b[14]?.pressed ? 1 : 0);
        my = (b[12]?.pressed ? 1 : 0) - (b[13]?.pressed ? 1 : 0);
      }
    }
    this.move.x = mx; this.move.y = my;
    this.aim.x = ax; this.aim.y = ay;

    // --- actions
    for (const name of ['A', 'B', 'X', 'Y', 'START', 'VIEW', 'SPRINT', 'HELP', 'TACTIC']) {
      let h = KEYMAP[name].some((c) => k.has(c));
      if (pad) {
        const idx = name === 'START' ? START_BTN : name === 'VIEW' ? VIEW_BTN : name === 'SPRINT' ? SPRINT_BTN : name === 'HELP' ? HELP_BTN : name === 'TACTIC' ? this.tacticButton() : this.mapping[name];
        if (isDown(pad.buttons[idx])) h = true;
      }
      this.pressed[name] = h && !this._prev[name];
      this.held[name] = h;
      this._prev[name] = h;
    }
    // contre-vitre : les actions A et B ensemble (A+B, ou RT+LT en mode gâchettes), ou la touche U
    const combo = (this.held.A && this.held.B) || k.has(COMBO_KEY);
    this.pressed.C = combo && !this._prev.C;
    this.held.C = combo;
    this._prev.C = combo;
    // smash « par 3 / par 4 » : X et Y ensemble, ou la touche O ; demande un bon timing
    const kick = (this.held.X && this.held.Y) || k.has('KeyO');
    this.pressed.D = kick && !this._prev.D;
    this.held.D = kick;
    this._prev.D = kick;

    // --- navigation menu (toujours A/B de la manette, quelle que soit la configuration)
    const m = this._menuState(pad, mx, my);
    for (const key in m) {
      this.menu[key] = m[key] && !this._prevMenu[key];
      this._prevMenu[key] = m[key];
    }
  }

  _menuState(pad, mx, my) {
    const k = this.keys;
    return {
      up: k.has('ArrowUp') || k.has('KeyW') || my > 0.6,
      down: k.has('ArrowDown') || k.has('KeyS') || my < -0.6,
      left: k.has('ArrowLeft') || k.has('KeyA') || mx < -0.6,
      right: k.has('ArrowRight') || k.has('KeyD') || mx > 0.6,
      confirm: k.has('Enter') || k.has('Space') || k.has('KeyK') || !!pad?.buttons[0]?.pressed,
      back: k.has('Escape') || k.has('KeyL') || !!pad?.buttons[1]?.pressed,
    };
  }

  _syncPrev(pad) {
    const m = this._menuState(pad, 0, 0);
    for (const key in m) this._prevMenu[key] = m[key];
    for (const name of ['A', 'B', 'X', 'Y', 'START']) {
      const idx = name === 'START' ? START_BTN : this.mapping[name];
      this._prev[name] = KEYMAP[name].some((c) => this.keys.has(c)) || (pad ? isDown(pad.buttons[idx]) : false);
    }
  }

  /** Vibration (Chrome / Edge : "dual-rumble"). */
  rumble(strong = 0.5, weak = 0.5, duration = 80) {
    const act = this.getPad()?.vibrationActuator;
    if (act?.playEffect) {
      act.playEffect('dual-rumble', { startDelay: 0, duration, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    }
  }

  /** Nom d'un bouton de manette selon le modèle détecté. */
  buttonName(index, type = this.padType === 'keyboard' ? 'xbox' : this.padType) {
    return (PAD_NAMES[type] || PAD_NAMES.xbox)[index] ?? `B${index}`;
  }

  /** Libellés des actions selon le périphérique et la configuration. */
  labels() {
    if (this.padType === 'keyboard') return { A: 'K', B: 'L', X: 'J', Y: 'I', C: 'U', VIEW: 'C', SPRINT: 'Maj', START: 'Échap', move: 'ZQSD', aim: 'Flèches' };
    const n = (a) => this.buttonName(this.mapping[a]);
    return {
      A: n('A'), B: n('B'), X: n('X'), Y: n('Y'), C: `${n('A')}+${n('B')}`,
      VIEW: this.buttonName(VIEW_BTN), SPRINT: this.padType === 'playstation' ? 'L3' : 'LS',
      START: this.padType === 'playstation' ? 'Options' : 'Menu', move: 'Stick G', aim: 'Stick D',
    };
  }
}
