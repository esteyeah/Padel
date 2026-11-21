// ============================================================================
//  Caméras :
//   tv       retransmission TV, haut derrière la vitre (par défaut)
//   tvwide   retransmission TV large, plus haute et plus reculée
//   third    3e personne, juste derrière le joueur
//   first    1re personne, à hauteur des yeux (l'avatar du joueur est masqué)
//   side     vue latérale (tribune), suit la balle le long du court
//   aerial   vue aérienne
//  + modes internes : attract (orbite du menu) et showcase (éditeur de joueur).
//  inputBasis() donne les directions écran -> terrain pour les déplacements.
// ============================================================================
import * as THREE from 'three';

export const CAMERA_MODES = [
  { id: 'tv', label: 'TV' },
  { id: 'tvwide', label: 'TV large' },
  { id: 'third', label: '3e personne' },
  { id: 'first', label: '1re personne (caméra balle)' },
  { id: 'ballcam', label: 'Caméra balle (3e personne)' },
  { id: 'side', label: 'Latérale' },
  { id: 'aerial', label: 'Aérienne' },
];

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 7.5, 17.5);
    this.look = new THREE.Vector3(0, 0.4, -0.5);
    this.shake = 0;
    this.orbit = 0;
    this.mode = 'tv';
    this._tp = new THREE.Vector3();
    this._tl = new THREE.Vector3();
  }

  kick(amount) { this.shake = Math.min(0.35, this.shake + amount); }

  setMode(id) { this.mode = id; this.snap = true; }

  cycle() {
    const i = CAMERA_MODES.findIndex((m) => m.id === this.mode);
    this.setMode(CAMERA_MODES[(i + 1) % CAMERA_MODES.length].id);
    return CAMERA_MODES.find((m) => m.id === this.mode).label;
  }

  /** Directions "haut" et "droite" du stick, en coordonnées terrain, pour le joueur du camp side. */
  inputBasis(side) {
    if (this.mode === 'side') return { fx: -1, fz: 0, rx: 0, rz: -1 };
    if (this.mode === 'first' || this.mode === 'ballcam') {
      // déplacements relatifs à la caméra, qui suit la balle (direction horizontale lissée)
      const f = this._fwd || { x: 0, z: -side };
      return { fx: f.x, fz: f.z, rx: -f.z, rz: f.x };
    }
    return { fx: 0, fz: -side, rx: side, rz: 0 };
  }

  update(dt, { focus, ball, attract, showcase, side = 1, heading = 0 }) {
    const tp = this._tp, tl = this._tl;
    let k = 1 - Math.exp(-dt * 2.6), kl = 1 - Math.exp(-dt * 3.5);
    let fov = null;
    if (showcase) {
      // gros plan sur le personnage, décalé à droite pour laisser la place au panneau
      tp.set(-0.5, 1.45, 10.4);
      tl.set(-0.35, 0.98, 6.2);
      k = kl = 1 - Math.exp(-dt * 4);
    } else if (attract) {
      this.orbit += dt * 0.06;
      tp.set(Math.sin(this.orbit) * 21, 8.5 + Math.sin(this.orbit * 0.7) * 1.5, Math.cos(this.orbit) * 21);
      tl.set(0, 0.6, 0);
      k = kl = 1 - Math.exp(-dt * 1.2);
    } else {
      const px = focus ? focus.x : 0, pz = focus ? focus.z : 8 * side;
      const bx = ball.x, by = ball.y, bz = ball.z;
      switch (this.mode) {
        case 'tvwide':
          tp.set(px * 0.2, 11 + Math.max(0, by - 4) * 0.3, side * 21);
          tl.set(px * 0.15 + bx * 0.15, 0.2, side * -0.5 + bz * 0.08);
          break;
        case 'third':
          tp.set(px * 0.85 + bx * 0.08, 2.9, pz + side * 4.4);
          tl.set(px * 0.6 + bx * 0.35, 1.0, pz - side * 6 + (bz - pz) * 0.15);
          k = 1 - Math.exp(-dt * 5); kl = 1 - Math.exp(-dt * 6);
          break;
        case 'first': {
          // yeux du joueur ; le regard suit la balle en permanence (caméra « balle »)
          tp.set(px, 1.64, pz);
          tl.set(bx, Math.max(0.2, by), bz);
          if (tl.distanceTo(tp) < 0.6) tl.set(px, 1.3, pz - side * 3);
          k = 1 - Math.exp(-dt * 16); kl = 1 - Math.exp(-dt * 9);
          fov = 74;
          break;
        }
        case 'ballcam': {
          // derrière le joueur, dans l'axe joueur -> balle, comme une caméra « ballon »
          let dx = bx - px, dz = bz - pz;
          const l = Math.hypot(dx, dz);
          if (l < 0.5) { dx = 0; dz = -side; } else { dx /= l; dz /= l; }
          tp.set(px - dx * 4.2, 2.4, pz - dz * 4.2);
          // reste dans la cage (sinon on filme à travers le grillage) : on monte un peu si on bute
          const cx = Math.max(-4.6, Math.min(4.6, tp.x)), cz = Math.max(-9.6, Math.min(9.6, tp.z));
          tp.y += (Math.abs(cx - tp.x) + Math.abs(cz - tp.z)) * 0.5;
          tp.x = cx; tp.z = cz;
          tl.set(bx * 0.6 + px * 0.4, Math.max(0.6, by * 0.7), bz * 0.6 + pz * 0.4);
          k = 1 - Math.exp(-dt * 5); kl = 1 - Math.exp(-dt * 7);
          fov = 64;
          break;
        }
        case 'side':
          tp.set(9.6, 4.6, bz * 0.45);
          tl.set(0, 0.6, bz * 0.55);
          fov = 52;
          break;
        case 'aerial':
          tp.set(px * 0.1, 25, side * 7);
          tl.set(0, 0, side * 0.5);
          break;
        default: // tv
          tp.set(px * 0.35 + bx * 0.1, 7.3 + Math.max(0, by - 4) * 0.3, side * (17.2 + (pz * side - 8) * 0.28));
          tl.set(px * 0.28 + bx * 0.22, 0.35 + Math.min(by, 6) * 0.06, side * -1.2 + bz * 0.12);
      }
      // caméra tenue par un opérateur : micro-mouvements lents (pas en 1re personne)
      if (this.mode !== 'first') {
        this._hand = (this._hand || 0) + dt;
        const h = this._hand;
        tp.x += Math.sin(h * 0.7) * 0.05 + Math.sin(h * 1.9) * 0.015;
        tp.y += Math.sin(h * 0.53 + 1) * 0.035;
        tl.x += Math.sin(h * 0.61 + 2) * 0.03;
      }
    }
    // lieu couvert : la caméra reste sous le toit
    if (this.indoor && !showcase) { tp.y = Math.min(tp.y, 6.9); tp.z = Math.max(-19.5, Math.min(19.5, tp.z)); }
    if (this.snap) { k = kl = 1; this.snap = false; }
    this.pos.lerp(tp, k);
    this.look.lerp(tl, kl);
    this.camera.position.copy(this.pos);
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-dt * 9);
    }
    this.camera.lookAt(this.look);
    // direction horizontale de la caméra (pour les déplacements relatifs)
    const fx = this.look.x - this.pos.x, fz = this.look.z - this.pos.z, fl = Math.hypot(fx, fz);
    if (fl > 0.2) {
      const nx = fx / fl, nz = fz / fl;
      this._fwd = this._fwd ? { x: this._fwd.x + (nx - this._fwd.x) * 0.15, z: this._fwd.z + (nz - this._fwd.z) * 0.15 } : { x: nx, z: nz };
      const n = Math.hypot(this._fwd.x, this._fwd.z) || 1; this._fwd.x /= n; this._fwd.z /= n;
    }
    // champ de vue : valeur de base gérée par Renderer3D, élargie pour certaines vues
    const base = this.camera.userData.baseFov ?? 46;
    const target = fov && !attract && !showcase ? Math.max(fov, base) : base;
    if (Math.abs(this.camera.fov - target) > 0.1) {
      this.camera.fov += (target - this.camera.fov) * (1 - Math.exp(-dt * 8));
      this.camera.updateProjectionMatrix();
    }
  }
}
