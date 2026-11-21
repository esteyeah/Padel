// ============================================================================
//  Sons synthétisés en Web Audio (aucun fichier) : frappe "pock", rebond sol,
//  vitre (sourd + résonance), grillage (cliquetis métallique), filet, public.
//  Ambiance : petite valse musette d'accordéon (fête de village) dans les petits
//  clubs, rumeur de la foule dans les grands stades.
// ============================================================================
// Répertoire de l'orchestre (musette, java, polka).
const TUNES = [
  { name: 'Valse musette', meter: 3, beat: 0.36,
    chords: [[48, 64, 67], [43, 62, 65], [48, 64, 67], [41, 60, 65], [48, 64, 67], [43, 62, 65], [48, 64, 67], [48, 64, 67]],
    melody: [[76, 74, 72], [71, 74, 77], [76, 79, 76], [77, 76, 74], [72, 76, 79], [79, 77, 74], [72, 74, 76], [72, -1, -1],
      [79, 81, 79], [77, 74, 71], [72, 76, 79], [81, 79, 77], [76, 72, 76], [74, 71, 67], [72, 76, 74], [72, -1, -1]] },
  { name: 'Valse en mineur', meter: 3, beat: 0.4,
    chords: [[45, 60, 64], [40, 59, 62], [45, 60, 64], [45, 60, 64], [38, 62, 65], [45, 60, 64], [40, 59, 64], [45, 60, 64]],
    melody: [[76, -1, 72], [71, 74, 76], [77, 76, 74], [72, -1, 0], [74, 77, 81], [81, 79, 77], [76, 74, 71], [69, -1, -1]] },
  { name: 'Polka', meter: 2, beat: 0.27,
    chords: [[41, 60, 65], [36, 58, 64], [41, 60, 65], [41, 60, 65], [46, 62, 65], [41, 60, 65], [36, 58, 64], [41, 60, 65]],
    melody: [[72, 69], [67, 70], [69, 72], [77, -1], [74, 77], [72, 69], [67, 64], [65, -1],
      [69, 72], [77, 76], [74, 72], [70, 67], [74, 70], [69, 72], [67, 70], [65, -1]] },
  { name: 'Java', meter: 3, beat: 0.5,
    chords: [[43, 59, 62], [38, 60, 66], [43, 59, 62], [48, 60, 64], [43, 59, 62], [38, 60, 66], [43, 62, 67], [43, 59, 62]],
    melody: [[71, 74, 79], [78, -1, 74], [71, -1, 67], [72, 76, 79], [79, 78, 76], [74, 72, 69], [67, 71, 74], [79, -1, -1]] },
  { name: 'Bal du samedi', meter: 3, beat: 0.33,
    chords: [[46, 62, 65], [41, 60, 64], [41, 60, 63], [46, 62, 65], [39, 63, 67], [46, 62, 65], [41, 60, 64], [46, 62, 65]],
    melody: [[70, 74, 77], [77, 76, 74], [72, 75, 77], [74, -1, 70], [75, 79, 82], [82, 79, 77], [76, 72, 69], [70, -1, -1]] },
];

export class Sfx {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.musicEnabled = true;
    this.music = null;
    this.wantMusic = null;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 2);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.wantMusic && !this.music) this.setAmbience(this.wantMusic);
    } catch { /* audio indisponible */ }
  }

  // ------------------------------------------------------------------ ambiance
  /** 'village' (accordéon), 'stadium' (rumeur de foule) ou null (silence). */
  setAmbience(kind) {
    this.wantMusic = kind;
    if (!this.musicEnabled) kind = null;
    if (this.music?.kind === kind) return;
    this.stopAmbience();
    if (!kind || !this.ready) return;
    const c = this.ctx;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.linearRampToValueAtTime(kind === 'village' ? 0.1 : kind === 'electro' ? 0.07 : kind === 'sono' ? 0.08 : 0.06, c.currentTime + 2.5);
    gain.connect(this.master);
    this.music = { kind, gain, nodes: [] };
    if (kind === 'electro') {
      // électro-pop diffusée par les enceintes du hangar : son filtré (bande médium) et légère réverbération
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4800;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
      const dl = c.createDelay(); dl.delayTime.value = 0.09; const fb = c.createGain(); fb.gain.value = 0.25;
      const bus = c.createGain(); bus.connect(hp).connect(lp).connect(gain); lp.connect(dl).connect(fb).connect(dl); dl.connect(gain);
      this.music.bus = bus;
      this.music.next = c.currentTime + 0.2; this.music.step = 0;
      this._playlist(this.music);
    } else if (kind === 'sono') {
      // enceintes de fête en plein air : bande plus large que la sono du hangar, sans écho de salle
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 75;
      const mid = c.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1800; mid.Q.value = 0.8; mid.gain.value = 3;
      const bus = c.createGain(); bus.connect(hp).connect(mid).connect(lp).connect(gain);
      this.music.bus = bus;
      this._playlist(this.music);
    } else if (kind === 'village') {
      this.music.next = c.currentTime + 0.2;
      this.music.step = 0;
      this.music.timer = setInterval(() => this._waltz(), 120);
    } else {
      // rumeur de foule : bruit filtré, légèrement modulé
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.7;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
      const lg = c.createGain(); lg.gain.value = 0.3;
      const amp = c.createGain(); amp.gain.value = 0.7;
      lfo.connect(lg).connect(amp.gain);
      src.connect(f).connect(amp).connect(gain);
      src.start(); lfo.start();
      this.music.nodes.push(src, lfo);
    }
  }

  // vraies musiques (NCS) diffusées par les enceintes ; repli sur l'électro de synthèse
  async _playlist(m) {
    const c = this.ctx;
    try {
      const tracks = (await import('../assets/music.js')).default;
      let i = Math.floor(Math.random() * tracks.length);
      const play = async () => {
        if (this.music !== m) return;
        const tr = tracks[i];
        // site en ligne : fichier MP3 séparé ; version autonome : MP3 intégré en base64
        const bin = tr.url ? await (await fetch(tr.url)).arrayBuffer() : Uint8Array.from(atob(tr.data.split(',')[1]), (ch) => ch.charCodeAt(0)).buffer;
        const buf = await c.decodeAudioData(bin);
        if (this.music !== m) return;
        const src = c.createBufferSource(); src.buffer = buf;
        const g = c.createGain(); g.gain.value = 2.2;
        src.connect(g).connect(m.bus); src.start();
        m.src = src;
        i = (i + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length;
        src.onended = () => setTimeout(play, 1500);
      };
      await play();
    } catch (e) {
      if (this.music === m) m.timer = setInterval(() => this._electro(), 100);
    }
  }

  stopAmbience() {
    const m = this.music;
    if (!m) return;
    clearInterval(m.timer);
    try { if (m.src) { m.src.onended = null; m.src.stop(this.ctx.currentTime + 1.2); } } catch (e) {}
    const c = this.ctx;
    m.gain.gain.cancelScheduledValues(c.currentTime);
    m.gain.gain.setValueAtTime(m.gain.gain.value, c.currentTime);
    m.gain.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.8);
    setTimeout(() => { for (const n of m.nodes) { try { n.stop(); } catch { /* déjà arrêté */ } } m.gain.disconnect(); }, 1000);
    this.music = null;
  }

  /** Note d'accordéon : deux ondes légèrement désaccordées, filtrées, avec un léger vibrato. */
  _accordion(freq, t, dur, vol, out) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 0.6;
    const vib = c.createOscillator(); vib.frequency.value = 5.6;
    const vg = c.createGain(); vg.gain.value = freq * 0.004;
    vib.connect(vg);
    for (const [type, det] of [['sawtooth', -5], ['square', 6]]) {
      const o = c.createOscillator();
      o.type = type; o.frequency.value = freq; o.detune.value = det;
      vg.connect(o.frequency);
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.05);
    }
    vib.start(t); vib.stop(t + dur + 0.05);
    f.connect(g).connect(out);
  }

  /** Note chantée : source riche (dents de scie) passée dans deux formants de voyelle, léger vibrato. */
  _sing(f, t, dur, [f1, f2], out) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const vib = c.createOscillator(); vib.frequency.value = 5.5; const vg = c.createGain(); vg.gain.value = f * 0.012; vib.connect(vg).connect(o.frequency);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.04); g.gain.setValueAtTime(0.16, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    for (const [ff, qq, gg] of [[f1, 8, 1], [f2, 10, 0.6]]) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff; b.Q.value = qq; const m = c.createGain(); m.gain.value = gg; o.connect(b).connect(m).connect(g); }
    g.connect(out);
    o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }

  /** Boucle électro-pop : kick, charleston, basse et nappe d'accords (4 accords, 120 bpm). */
  _electro() {
    const m = this.music, c = this.ctx;
    if (!m || m.kind !== 'electro') return;
    const hz = (n) => 440 * 2 ** ((n - 69) / 12), q = 60 / 120 / 4;
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const bassL = [45, 41, 36, 43];
    while (m.next < c.currentTime + 0.4) {
      const t = m.next, st = m.step % 16, bar = Math.floor(m.step / 16) % 4;
      const out = m.bus;
      if (st % 4 === 0) {      // kick
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(g).connect(out); o.start(t); o.stop(t + 0.25);
      }
      if (st % 4 === 2 && this.noise) { // charleston
        const s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = c.createGain();
        g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + 0.06);
      }
      if (st % 2 === 0) {      // basse
        const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = hz(bassL[bar] + (st % 8 === 6 ? 12 : 0));
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
        g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + q * 1.8);
        o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + q * 2);
      }
      // voix chantée : syllabes en formants (« oh-oh », « yeah ») sur une mélodie, une mesure sur deux
      const mel = [[69, 0], [72, 2], [74, 4], [72, 6], [69, 10], [67, 12]], vow = [[800, 1150], [400, 800], [700, 1100], [500, 1000], [350, 1900], [800, 1150]];
      if (bar % 2 === 0 || bar === 3) mel.forEach(([n, at], k) => { if (st === at) this._sing(hz(n + (bar === 3 ? -2 : 0)), t, q * 1.7, vow[k], out); });
      if (st === 0 || st === 10) {  // nappe
        for (const n of prog[bar]) {
          const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = hz(n + 12);
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + q * 5);
          o.connect(g).connect(out); o.start(t); o.stop(t + q * 5.2);
        }
      }
      m.step++; m.next += q;
    }
  }

  /**
   * Orchestre de fête de village : il joue de temps en temps (un morceau tiré au hasard,
   * transposé et à un tempo variable), puis fait une pause de 25 à 70 s.
   *   meter 3 : basse sur le 1, accords sur 2 et 3 (valse, java) ; meter 2 : polka.
   *   mélodie : une note par temps, -1 = tenue, 0 = silence.
   */
  _waltz() {
    const m = this.music, c = this.ctx;
    if (!m || m.kind !== 'village') return;
    const hz = (n) => 440 * 2 ** ((n - 69) / 12);
    if (!m.tune) {
      if (m.restUntil == null) m.restUntil = c.currentTime + 1.5;   // l'orchestre est là toute la partie
      if (c.currentTime < m.restUntil) return;
      const choices = TUNES.map((_, i) => i).filter((i) => i !== m.lastTune);
      const idx = choices[Math.floor(Math.random() * choices.length)];
      m.lastTune = idx;
      const tune = TUNES[idx];
      m.tune = { ...tune, shift: Math.floor(Math.random() * 7) - 3, beat: tune.beat * (0.9 + Math.random() * 0.2), reps: 1 + Math.floor(Math.random() * 2) };
      m.step = 0;
      m.next = c.currentTime + 0.1;
    }
    const T = m.tune, M = T.meter, bars = T.melody.length;
    const total = bars * M * T.reps;
    while (m.tune && m.next < c.currentTime + 0.5) {
      if (m.step >= total) {
        m.tune = null;
        m.restUntil = c.currentTime + 2.5 + Math.random() * 3;   // courte respiration entre deux morceaux
        return;
      }
      const bar = Math.floor(m.step / M) % bars, b = m.step % M;
      const ch = T.chords[bar % T.chords.length].map((n) => n + T.shift), t = m.next;
      if (b === 0) this._accordion(hz(ch[0] - 12), t, T.beat * 0.9, 0.55, m.gain);
      else { this._accordion(hz(ch[1]), t, T.beat * 0.45, 0.22, m.gain); this._accordion(hz(ch[2]), t, T.beat * 0.45, 0.22, m.gain); }
      const note = T.melody[bar][b];
      if (note > 0) {
        let hold = 1;
        for (let k = m.step + 1; k < m.step + 4 && T.melody[Math.floor(k / M) % bars][k % M] === -1; k++) hold++;
        this._accordion(hz(note + T.shift), t, T.beat * (hold > 1 ? hold - 0.4 : 0.95), 0.32, m.gain);
      }
      m.step++;
      m.next += T.beat;
    }
  }

  get ready() { return this.ctx && this.ctx.state === 'running'; }

  _burst({ freq, q = 1, type = 'bandpass', dur, gain, delay = 0, attack = 0.002 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  _tone({ f0, f1, dur, gain, type = 'sine', delay = 0 }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hit(speed) {
    if (!this.ready) return;
    const k = Math.min(1, Math.max(0.2, speed / 30));
    this._burst({ freq: 1700 + k * 600, q: 1.4, dur: 0.05, gain: 0.25 + 0.45 * k });
    this._tone({ f0: 650 + k * 350, f1: 260, dur: 0.07, gain: 0.15 + 0.3 * k });
  }

  floor(speed) {
    if (!this.ready || speed < 0.8) return;
    const k = Math.min(1, speed / 12);
    this._burst({ freq: 700, type: 'lowpass', dur: 0.06, gain: 0.15 + 0.3 * k });
    this._tone({ f0: 220, f1: 90, dur: 0.06, gain: 0.12 + 0.2 * k });
  }

  glass(speed) {
    if (!this.ready) return;
    const k = Math.min(1, speed / 20);
    this._tone({ f0: 170, f1: 65, dur: 0.18, gain: 0.25 + 0.45 * k });
    this._burst({ freq: 950, q: 2.2, dur: 0.12, gain: 0.15 + 0.3 * k });
    this._tone({ f0: 2300, f1: 2200, dur: 0.22, gain: 0.03 * k, type: 'triangle' });
  }

  mesh(speed) {
    if (!this.ready) return;
    const k = Math.min(1, speed / 15);
    for (let i = 0; i < 6; i++) {
      this._burst({ freq: 2800 + Math.random() * 2500, q: 6, dur: 0.035, gain: (0.12 + 0.25 * k) * (1 - i / 6), delay: i * 0.022 + Math.random() * 0.01 });
    }
    this._tone({ f0: 430, f1: 390, dur: 0.25, gain: 0.03 + 0.04 * k, type: 'square' });
  }

  net() {
    if (!this.ready) return;
    this._burst({ freq: 380, type: 'lowpass', dur: 0.14, gain: 0.3 });
  }

  crowd(intensity = 0.5) {
    if (!this.ready) return;
    const n = Math.floor(10 + intensity * 30);
    this._burst({ freq: 1100, q: 0.4, dur: 1.6 + intensity, gain: 0.05 + 0.1 * intensity, attack: 0.25 });
    for (let i = 0; i < n; i++) {
      this._burst({ freq: 1500 + Math.random() * 1500, q: 1.5, dur: 0.03, gain: 0.04 + Math.random() * 0.06 * intensity, delay: Math.random() * (1.2 + intensity) });
    }
  }
}
