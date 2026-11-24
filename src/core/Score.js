// ============================================================================
//  Comptage des points façon padel : 15/30/40, avantage ou point en or,
//  jeux, sets, jeu décisif à 6-6, rotation du service.
//  Les camps sont identifiés par side = +1 (proche caméra) / -1 (loin).
// ============================================================================
const LABELS = ['0', '15', '30', '40'];
const idx = (side) => (side > 0 ? 0 : 1);

export class Score {
  /**
   * @param {object} o
   * @param {number} o.matchTiebreak  0 = match normal ; 7 = un tie-break ; 10 = un super tie-break
   */
  constructor({ sets = 1, goldenPoint = true, firstServer = 1, gamesPerSet = 6, matchTiebreak = 0 } = {}) {
    this.setsToWin = sets >= 3 ? 2 : 1;
    this.N = gamesPerSet;     // jeux pour gagner un set (6 normal, 4 = set court)
    this.golden = goldenPoint;
    this.points = [0, 0];
    this.games = [0, 0];
    this.setsWon = [0, 0];
    this.history = [];        // jeux des sets terminés
    this.tiebreak = false;
    this.tbFirstServer = null;
    this.server = firstServer;
    this.turn = 0;            // incrémenté à chaque changement de serveur (rotation en double)
    this.winner = null;
    this.tbTarget = 7;
    this.matchTiebreak = matchTiebreak;
    if (matchTiebreak) {
      this.tiebreak = true;
      this.tbTarget = matchTiebreak;
      this.tbFirstServer = firstServer;
    }
  }

  /** Attribue le point au camp `side`. Retourne ce qui a été gagné. */
  pointTo(side) {
    const before = this.server;
    const res = this._pointTo(side);
    if (this.server !== before) this.turn++;
    return res;
  }

  _pointTo(side) {
    const i = idx(side), o = 1 - i;
    const res = { side, game: false, set: false, match: false };
    this.points[i]++;
    const a = this.points[i], b = this.points[o];

    if (this.tiebreak) {
      if (a >= this.tbTarget && (a - b >= 2 || this.sudden)) {
        this.games[i]++;
        if (this.matchTiebreak) {
          // match en un seul (super) tie-break : le score affiché est celui des points
          this.history.push(this.points.slice());
          this.setsWon[i]++;
          res.game = res.set = res.match = true;
          this.winner = i === 0 ? 1 : -1;
        } else this._winSet(i, res);
        this.server = -this.tbFirstServer;
      } else {
        const total = a + b;
        // le premier serveur sert 1 point, puis alternance tous les 2 points
        this.server = Math.floor((total + 1) / 2) % 2 === 0 ? this.tbFirstServer : -this.tbFirstServer;
      }
      return res;
    }

    let gameWon = false;
    if (this.golden) gameWon = a >= 4;
    else {
      if (a >= 4 && a - b >= 2) gameWon = true;
      else if (a >= 4 && a === b) { this.points = [3, 3]; } // retour à égalité
    }
    if (gameWon) {
      res.game = true;
      this.points = [0, 0];
      this.games[i]++;
      this.server = -this.server;
      const g = this.games[i], h = this.games[o];
      const N = this.N;
      if ((g >= N && g - h >= 2) || g === N + 1) this._winSet(i, res);
      else if (g === N && h === N) {
        this.tiebreak = true;
        this.tbFirstServer = this.server;
      }
    }
    return res;
  }

  _winSet(i, res) {
    res.game = true;
    res.set = true;
    this.history.push([...this.games]);
    this.setsWon[i]++;
    this.games = [0, 0];
    this.points = [0, 0];
    this.tiebreak = false;
    if (this.setsWon[i] >= this.setsToWin) {
      res.match = true;
      this.winner = i === 0 ? 1 : -1;
    }
  }

  /** Service côté droit (égalité) si le total des points du jeu est pair. */
  deuceSide() { return (this.points[0] + this.points[1]) % 2 === 0; }

  isGoldenPoint() { return this.golden && !this.tiebreak && this.points[0] === 3 && this.points[1] === 3; }

  label(side) {
    const i = idx(side), o = 1 - i;
    const a = this.points[i], b = this.points[o];
    if (this.tiebreak) return String(a);
    if (a >= 3 && b >= 3) {
      if (a === b) return '40';
      return a > b ? 'AV' : '40';
    }
    return LABELS[Math.min(a, 3)];
  }
  gamesOf(side) { return this.games[idx(side)]; }
  setsOf(side) { return this.setsWon[idx(side)]; }
}
