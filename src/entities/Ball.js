// ============================================================================
//  Balle : état physique + rendu (sphère, ombre portée, traînée, écrasement
//  visuel à l'impact pour matérialiser la compression sur les vitres).
// ============================================================================
import * as THREE from 'three';
import { BALL } from '../config.js';
import { BallState, stepBall } from '../physics/BallPhysics.js';
import { makeBlobTexture } from '../render/Textures.js';

const UP = new THREE.Vector3(0, 1, 0);
const TRAIL = 26;

export class Ball {
  constructor(scene) {
    this.state = new BallState();
    this.held = false;

    const mat = new THREE.MeshStandardMaterial({ color: 0xe4ff2e, roughness: 0.6, emissive: 0x4a5c00, emissiveIntensity: 0.45 });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL.visualRadius, 24, 16), mat);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: makeBlobTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 3;
    scene.add(this.shadow);

    const pos = new Float32Array(TRAIL * 3);
    const col = new Float32Array(TRAIL * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    this.trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    this.trail.frustumCulled = false;
    this.trail.visible = false;            // pas de traînée en l'air
    scene.add(this.trail);
    this.trailPos = pos; this.trailCol = col;
    this.trailInit = false;

    this.squash = 0;
    this.squashNormal = new THREE.Vector3(0, 1, 0);
    this._q = new THREE.Quaternion();
  }

  step(dt, emit) {
    if (this.held) return;
    stepBall(this.state, dt, emit);
  }

  setVisible(v) { this.mesh.visible = v; this.shadow.visible = v; this.trail.visible = v; }

  holdAt(p) {
    this.held = true;
    this.state.reset(p);
  }

  release(p) {
    this.held = false;
    this.state.reset(p);
  }

  /** Écrasement visuel (proportionnel à la vitesse d'impact). */
  onImpact(e) {
    const s = Math.min(0.5, (e.speed || 0) / 32);
    if (s < 0.05) return;
    this.squash = s;
    this.squashNormal.set(e.nx || 0, e.ny ?? 1, e.nz || 0).normalize();
  }

  updateVisual(dt) {
    const p = this.state.p;
    this.mesh.position.copy(p);
    if (this.squash > 0.01) {
      this._q.setFromUnitVectors(UP, this.squashNormal);
      this.mesh.quaternion.copy(this._q);
      const s = this.squash;
      this.mesh.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
      this.squash *= Math.exp(-dt * 40);
    } else {
      this.mesh.scale.set(1, 1, 1);
    }

    // ombre "blob"
    const h = Math.max(0, p.y);
    this.shadow.position.set(p.x, 0.006, p.z);
    const sc = 0.12 + h * 0.035;
    this.shadow.scale.set(sc, sc, sc);
    this.shadow.material.opacity = Math.max(0, 0.65 - h * 0.09);

    // traînée
    const tp = this.trailPos, tc = this.trailCol;
    if (!this.trailInit || this.held) {
      for (let i = 0; i < TRAIL; i++) { tp[i * 3] = p.x; tp[i * 3 + 1] = p.y; tp[i * 3 + 2] = p.z; }
      this.trailInit = true;
    }
    tp.copyWithin(3, 0, (TRAIL - 1) * 3);
    tp[0] = p.x; tp[1] = p.y; tp[2] = p.z;
    const speed = this.state.v.length();
    const k = Math.min(1, Math.max(0, (speed - 6) / 14));
    for (let i = 0; i < TRAIL; i++) {
      const a = (1 - i / TRAIL) * 0.55 * k;
      tc[i * 4] = 1; tc[i * 4 + 1] = 1; tc[i * 4 + 2] = 0.75; tc[i * 4 + 3] = a;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
  }
}
