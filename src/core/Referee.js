// ============================================================================
//  Arbitre : interprète les évènements physiques de la balle selon les règles
//  du padel et décide des points / fautes de service / lets.
//
//  Règles clés implémentées :
//   - après la frappe, la balle doit franchir le filet et toucher D'ABORD le sol adverse ;
//   - le frappeur peut utiliser ses propres murs avant que la balle franchisse le filet ;
//   - après le rebond, vitres et grillage adverses sont en jeu ;
//   - second rebond au sol = point pour le frappeur ;
//   - service : rebond dans le carré en diagonale, grillage après rebond = faute,
//     let si la balle touche le filet puis tombe dans le carré ;
//   - le retour de service doit rebondir (pas de volée) -> géré dans Game.canHit.
// ============================================================================
import { COURT, VENUE_RULES } from '../config.js';

const point = (winner, reason) => ({ kind: 'point', winner, reason });
const fault = (reason) => ({ kind: 'fault', reason });

export class Referee {
  constructor() { this.reset(); }

  reset() {
    this.lastHitterSide = 0;
    this.crossed = false;
    this.bounces = 0;
    this.isServe = false;
    this.serveNet = false;
    this.netHit = false;
    this.decided = false;
    this.serveBox = null;
    this.outside = false;     // balle jouée à l'extérieur de la piste
  }

  /** Carré de service visé : xSign/zSign du carré adverse. */
  prepareServe(box) {
    this.reset();
    this.serveBox = box;
  }

  onHit(player, shotType) {
    this.lastHitterSide = player.side;
    this.crossed = false;
    this.bounces = 0;
    this.isServe = shotType === 'serve';
    this.serveNet = false;
    this.netHit = false;
    this.outside = false;
  }

  inServiceBox(e) {
    const b = this.serveBox;
    if (!b) return true;
    const tol = COURT.lineW * 0.5 + 0.01;
    const d = e.z * b.zSign;
    return d > 0 && d <= COURT.serviceLine + tol && e.x * b.xSign >= -tol && Math.abs(e.x) <= COURT.halfW;
  }

  _decide(d) { this.decided = true; return d; }

  handle(e) {
    if (this.decided || !this.lastHitterSide) return null;
    const H = this.lastHitterSide, Rcv = -H;
    const S = this.isServe;

    switch (e.type) {
      case 'cross':
        if (e.to === Rcv) this.crossed = true;
        else if (e.to === H && this.crossed && this.bounces >= 1) {
          return this._decide(point(H, 'La balle revient dans le camp du frappeur'));
        }
        return null;

      case 'netcord':
        if (S) this.serveNet = true;
        this.netHit = true;
        return null;

      case 'net':
        this.netHit = true;
        return null;

      case 'floor':
        if (!this.crossed) {
          if (S) return this._decide(fault(this.netHit ? 'Filet' : 'Service raté'));
          return this._decide(point(Rcv, this.netHit ? 'Filet' : 'Faute directe'));
        }
        if (e.side === Rcv) {
          this.bounces++;
          if (this.bounces === 1 && S) {
            if (!this.inServiceBox(e)) return this._decide(fault('Service hors du carré'));
            if (this.serveNet) return this._decide({ kind: 'let' });
          }
          if (this.bounces >= 2) return this._decide(point(H, this.outside ? 'Balle non rattrapée à l\'extérieur' : 'Double rebond'));
        } else if (this.bounces >= 1) {
          return this._decide(point(H, 'La balle revient dans le camp du frappeur'));
        }
        if (this.outside && this.bounces >= 2) return this._decide(point(H, 'Balle non rattrapée à l\'extérieur'));
        return null;

      case 'glass':
      case 'mesh': {
        const what = e.type === 'glass' ? 'Vitre directe' : 'Grillage direct';
        if (!this.crossed) {
          // propres murs : autorisé en jeu, interdit au service
          if (S) return this._decide(fault(`Service dans ${e.type === 'glass' ? 'la vitre' : 'le grillage'}`));
          return null;
        }
        if (e.side === Rcv) {
          if (this.bounces === 0) {
            if (S) return this._decide(fault(what));
            return this._decide(point(Rcv, what));
          }
          if (S && e.type === 'mesh') return this._decide(fault('Service dans le grillage'));
          return null;
        }
        if (this.bounces >= 1) return this._decide(point(H, 'La balle revient dans le camp du frappeur'));
        return null;
      }

      case 'out':
        if (this.crossed && this.bounces >= 1) {
          // sortie latérale (porte ou par-dessus le grillage) : on peut la rattraper dehors
          if (!S && VENUE_RULES.outside && e.wall === 'side' && e.side === Rcv) { this.outside = e.via; return null; }
          return this._decide(point(H, e.via === 'door' ? 'Sortie par la porte (por cuatro)' : 'Balle sortie de la piste (por tres)'));
        }
        if (S) return this._decide(fault('Service dehors'));
        return this._decide(point(Rcv, 'Dehors'));

      case 'stopped':
        if (this.crossed && this.bounces >= 1) return this._decide(point(H, 'Balle morte'));
        if (S) return this._decide(fault('Service raté'));
        return this._decide(point(Rcv, 'Balle morte'));

      default:
        return null;
    }
  }

  /** Sécurité si un échange ne se termine jamais. */
  timeout() {
    const H = this.lastHitterSide || 1;
    if (this.crossed && this.bounces >= 1) return this._decide(point(H, 'Balle morte'));
    return this._decide(point(-H, 'Balle morte'));
  }
}
