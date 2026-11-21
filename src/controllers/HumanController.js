// ============================================================================
//  Contrôleur humain : transforme l'état de l'InputManager en "intention"
//  (déplacement monde, visée, boutons). La même interface servira pour un
//  contrôleur réseau (RemoteController) en multijoueur.
// ============================================================================
import { BUTTONS } from '../entities/Player.js';

export class HumanController {
  constructor(player, input) {
    this.player = player;
    this.input = input;
    this.pending = {};
  }

  /** Appelé une fois par image : mémorise les appuis jusqu'au prochain pas physique. */
  capture(dt, game) {
    this.basis = game?.cameraRig.inputBasis(this.player.side);
    for (const b of BUTTONS) if (this.input.pressed[b]) this.pending[b] = true;
    // visée lissée (réticule fluide)
    const k = 1 - Math.exp(-dt * 12);
    this.player.aim.x += (this.input.aim.x - this.player.aim.x) * k;
    this.player.aim.y += (this.input.aim.y - this.player.aim.y) * k;
  }

  getIntent() {
    const s = this.player.side;
    const pressed = this.pending;
    this.pending = {};
    // déplacement relatif à la caméra (vue de derrière : stick haut = vers le filet)
    const b = this.basis || { fx: 0, fz: -s, rx: s, rz: 0 };
    const mx = this.input.move.x, my = this.input.move.y;
    return {
      move: { x: b.rx * mx + b.fx * my, z: b.rz * mx + b.fz * my },
      held: this.input.held,
      pressed,
    };
  }
}
