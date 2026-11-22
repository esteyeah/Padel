// ============================================================================
//  HUD (DOM) : tableau de score type TV, bannières, jauge de puissance,
//  info du dernier coup, aide contextuelle, statut manette, pause et fin de match.
// ============================================================================
const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(input) {
    this.input = input;
    this.root = $('hud');
    this.sb = $('scoreboard');
    this.bannerEl = $('banner');
    this.powerEl = $('power');
    this.shotEl = $('shotinfo');
    this.hintEl = $('hint');
    this.padEl = $('pad-status');
    this.controlsEl = $('controls');
    this.pauseEl = $('pause');
    this.endEl = $('end');
    this.energyEl = $('energy');
    this.missionEl = $('mission');
    this.drillEl = $('drill');
    this.bannerT = 0;
    this.shotT = 0;
    this._padType = null;
  }

  show(v) { this.root.classList.toggle('hidden', !v); }

  /** teams : { 1: 'VOUS · LÉO', -1: 'MARCO · INÈS' } */
  setTeams(names) { this.teamNames = names; }

  updateScore(score) {
    const row = (side) => {
      const sets = score.history.map((g) => `<span class="set">${g[side > 0 ? 0 : 1]}</span>`).join('');
      const serving = score.server === side;
      return `<div class="sb-row ${side > 0 ? 'near' : 'far'}">
        <span class="srv ${serving ? 'on' : ''}"></span>
        <span class="name">${this.teamNames[side]}</span>
        ${sets}
        <span class="games">${score.gamesOf(side)}</span>
        <span class="pts">${score.label(side)}</span>
      </div>`;
    };
    const tag = score.tiebreak ? '<div class="sb-tag">JEU DÉCISIF</div>' : score.isGoldenPoint() ? '<div class="sb-tag gold">POINT EN OR</div>' : '';
    this.sb.innerHTML = row(1) + row(-1) + tag;
  }

  banner(big, small = '', dur = 1.8, color = '#fff') {
    this.bannerEl.innerHTML = `<div class="big" style="color:${color}">${big}</div><div class="small">${small}</div>`;
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
    this.bannerT = dur;
  }

  shotInfo(text, side) {
    this.shotEl.textContent = text;
    this.shotEl.className = `show ${side > 0 ? 'near' : 'far'}`;
    this.shotT = 1.6;
  }

  hint(text) {
    this.hintEl.textContent = text;
    this.hintEl.classList.toggle('show', !!text);
  }

  setPower(v, label) {
    if (v == null) { this.powerEl.classList.remove('show'); return; }
    this.powerEl.classList.add('show');
    this.powerEl.querySelector('.fill').style.width = `${Math.round(v * 100)}%`;
    this.powerEl.querySelector('.label').textContent = label;
    this.powerEl.classList.toggle('max', v >= 0.99);
  }

  update(dt) {
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.bannerEl.classList.remove('show');
    }
    if (this.shotT > 0) {
      this.shotT -= dt;
      if (this.shotT <= 0) this.shotEl.classList.remove('show');
    }
  }

  /** Affiche les contrôles correspondant à la manette détectée. */
  updatePad() {
    // H (clavier) ou clic du stick droit : masquer / afficher les aides en bas à gauche
    if (this.input.pressed.HELP) {
      this.helpHidden = !this.helpHidden;
      try { localStorage.setItem('padel-arena.help', this.helpHidden ? 'off' : 'on'); } catch { /* ignoré */ }
    }
    if (this.helpHidden === undefined) { try { this.helpHidden = localStorage.getItem('padel-arena.help') === 'off'; } catch { this.helpHidden = false; } }
    this.controlsEl.style.display = this.helpHidden ? 'none' : '';
    this.padEl.style.display = this.helpHidden && this.input.padType !== 'keyboard' ? 'none' : '';
    // la manette ne répond que si la page a le focus : on le signale
    const focus = document.hasFocus();
    if (focus !== this._focus) { this._focus = focus; this._ver = -1; }
    const type = this.input.padType;
    if (this.input.version === this._ver && type === this._padType) return;
    this._padType = type;
    this._ver = this.input.version;
    const names = { xbox: 'Manette Xbox', playstation: 'Manette PlayStation', generic: 'Manette', keyboard: 'Clavier' };
    this.padEl.innerHTML = !focus ? '<span class="dot"></span>Cliquez dans le jeu pour réactiver la manette et le clavier'
      : `<span class="dot ${type === 'keyboard' ? '' : 'on'}"></span>${names[type]}${type === 'keyboard' ? ' · branchez une manette et appuyez sur un bouton' : ' connectée'} · <kbd>${type === 'keyboard' ? 'H' : 'R3'}</kbd> masquer les aides`;
    const L = this.input.labels();
    const k = (t) => `<kbd>${t}</kbd>`;
    this.controlsEl.innerHTML = `
      <div>${k(L.move)} déplacement</div>
      <div>${k(L.aim)} visée</div>
      <div>${k(L.A)} coup droit / revers</div>
      <div>${k(L.X)} coupé · bas = amortie</div>
      <div>${k(L.Y)} smash / bandeja</div>
      <div>${k(L.B)} lob</div>
      <div>${k(L.C)} contre-vitre</div>
      <div>${k(this.input.padType === 'keyboard' ? 'O' : `${L.X}+${L.Y}`)} smash par 3 / par 4 (relâcher au bon moment)</div>
      <div>${k(L.VIEW)} caméra</div>
      <div>${k(L.SPRINT)} sprint</div>
      <div class="dim">Maintenir = puissance · ${k(L.START)} pause</div>`;
    const kb = type === 'keyboard';
    const menuL = { A: kb ? 'Entrée' : this.input.buttonName(0), B: kb ? 'Échap' : this.input.buttonName(1) };
    document.querySelectorAll('[data-menu]').forEach((el) => { el.textContent = menuL[el.dataset.menu]; });
  }

  /** Jauge de fatigue du joueur (1 = frais). */
  setEnergy(v) {
    const el = this.energyEl;
    if (!el) return;
    const pct = Math.round(v * 100);
    if (pct === this._energy) return;
    this._energy = pct;
    el.querySelector('.fill').style.width = `${pct}%`;
    el.classList.toggle('low', v < 0.45);
  }

  /** Mission du match (carrière). */
  setMission(text) {
    const el = this.missionEl;
    if (!el) return;
    if (text === this._mission) return;
    this._mission = text;
    el.textContent = text;
    el.classList.toggle('hidden', !text);
  }

  /** Bandeau d'entraînement (remplace le tableau de score). */
  setDrill(text) {
    if (text === this._drill) return;
    this._drill = text;
    this.drillEl.textContent = text || '';
    this.drillEl.classList.toggle('hidden', !text);
    this.sb.classList.toggle('hidden', !!text);
  }

  showDrillEnd(r) {
    const medals = ['AUCUNE MÉDAILLE', 'BRONZE', 'ARGENT', 'OR'];
    const colors = ['#ff8a80', '#d7a47a', '#cfd8dc', '#ffd400'];
    this.endEl.querySelector('.title').textContent = medals[r.medal];
    this.endEl.querySelector('.title').style.color = colors[r.medal];
    this.endEl.querySelector('.detail').textContent = `${r.label} · score ${r.score}`;
    this.endEl.querySelector('.confirm-label').textContent = 'Continuer';
    this.endEl.querySelector('.back-item').classList.add('hidden');
    this.endEl.classList.remove('hidden');
  }

  showPause(career = false) {
    this.pauseEl.querySelector('.back-label').textContent = career ? 'Abandonner' : 'Menu';
    this.pauseEl.querySelector('.quit-item').classList.toggle('hidden', !career);
    this.pauseEl.querySelector('.quit-key').textContent = this.input?.labels?.().X || 'X';
    this.pauseEl.classList.remove('hidden');
  }
  /** Bulle de réplique d'un joueur (quelques secondes). */
  speech(name, text, side = 1) {
    if (!this.speechEl) { this.speechEl = document.createElement('div'); this.speechEl.id = 'speech'; document.body.appendChild(this.speechEl); }
    this.speechEl.innerHTML = `<b>${name}</b>${text}`;
    this.speechEl.className = `on ${side > 0 ? 'near' : 'far'}`;
    clearTimeout(this._speechT);
    this._speechT = setTimeout(() => { this.speechEl.className = ''; }, 3200);
  }

  hideSpeech() { clearTimeout(this._speechT); if (this.speechEl) this.speechEl.className = ''; }

  /** Badge « REPLAY » pendant la relecture télé. */
  replayBadge(on, info = '') {
    if (!this.replayEl) {
      this.replayEl = document.createElement('div');
      this.replayEl.id = 'replay';
      this.replayEl.innerHTML = '<i></i>REPLAY<small>A : passer</small>';
      document.body.appendChild(this.replayEl);
      this.replayInfo = document.createElement('div');
      this.replayInfo.id = 'replay-info';
      document.body.appendChild(this.replayInfo);
      this.flashEl = document.createElement('div');
      this.flashEl.id = 'replay-flash';
      document.body.appendChild(this.flashEl);
    }
    this.replayEl.classList.toggle('on', !!on);
    this.replayInfo.classList.toggle('on', !!on && !!info);
    if (info) this.replayInfo.innerHTML = info;
  }

  replayFlash() {
    if (!this.flashEl) return;
    this.flashEl.classList.remove('go'); void this.flashEl.offsetWidth; this.flashEl.classList.add('go');
  }

  /** Bulle de dialogue des cinématiques (null pour la masquer). */
  dialog(name, text, more = false) {
    if (!this.dialogEl) {
      this.dialogEl = document.createElement('div');
      this.dialogEl.id = 'dialog';
      document.body.appendChild(this.dialogEl);
    }
    if (name === null) { this.dialogEl.classList.add('hidden'); return; }
    this.dialogEl.innerHTML = `<b>${name}</b><p>${text}</p><span class="d-next"><kbd>A</kbd> ${more ? 'Suite' : 'Commencer'} · <kbd>${this.input?.labels?.().START || 'Start'}</kbd> Passer</span>`;
    this.dialogEl.classList.remove('hidden');
  }

  hidePause() { this.pauseEl.classList.add('hidden'); }

  showEnd(score, human, career = false) {
    this.endEl.querySelector('.confirm-label').textContent = career ? 'Continuer' : 'Rejouer';
    this.endEl.querySelector('.back-item').classList.toggle('hidden', career);
    const won = human && human.side === score.winner;
    const sets = score.history.map((g) => `${g[0]}-${g[1]}`).join('  ');
    this.endEl.querySelector('.title').textContent = human ? (won ? 'VICTOIRE' : 'DÉFAITE') : `${this.teamNames[score.winner]} GAGNE`;
    this.endEl.querySelector('.title').style.color = !human ? '#fff' : won ? '#69f0ae' : '#ff8a80';
    this.endEl.querySelector('.detail').textContent = `${this.teamNames[1]}  ${sets}  ${this.teamNames[-1]}`;
    this.endEl.classList.remove('hidden');
  }
  hideEnd() { this.endEl.classList.add('hidden'); }
}
