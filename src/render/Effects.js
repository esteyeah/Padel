// ============================================================================
//  Effets visuels : réticule de visée, marqueur de rebond prévu, ondes d'impact
//  sur les vitres, anneau sous le joueur humain.
// ============================================================================
import * as THREE from 'three';
import { makeRingTexture } from './Textures.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const ringTex = makeRingTexture();

    // Réticule : anneau + point central
    this.reticle = new THREE.Group();
    const rMat = new THREE.MeshBasicMaterial({ map: ringTex, color: 0x7df9ff, transparent: true, depthWrite: false, opacity: 0.75 });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), rMat);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.85, depthWrite: false }));
    for (const m of [ring, dot]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 5; this.reticle.add(m); }
    dot.position.y = 0.001;
    this.reticle.position.y = 0.012;
    this.reticle.visible = false;
    this.reticleMat = rMat;
    this.reticleDot = dot;
    scene.add(this.reticle);
    this.reticleAlpha = 0;

    // Rebond prévu
    this.landing = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshBasicMaterial({ map: ringTex, color: 0xffe14d, transparent: true, depthWrite: false, opacity: 0 }),
    );
    this.landing.rotation.x = -Math.PI / 2; this.landing.position.y = 0.011; this.landing.renderOrder = 5;
    scene.add(this.landing);
    this.landingTarget = 0;

    // Anneau du joueur
    this.playerRing = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 1.0),
      new THREE.MeshBasicMaterial({ map: ringTex, color: 0x4fc3ff, transparent: true, depthWrite: false, opacity: 0.45 }),
    );
    this.playerRing.rotation.x = -Math.PI / 2; this.playerRing.position.y = 0.009; this.playerRing.renderOrder = 4;
    this.playerRing.visible = false;
    scene.add(this.playerRing);

    // Ondes d'impact (pool)
    this.waves = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: ringTex, color: 0xc8f7ff, transparent: true, depthWrite: false, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      );
      m.visible = false; m.renderOrder = 6;
      scene.add(m);
      this.waves.push({ mesh: m, t: 1, dur: 0.4, size: 1 });
    }
    this._n = new THREE.Vector3();
    this._time = 0;

    // traînée de la balle (balles rapides)
    const glow = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,220,0.5)'); r.addColorStop(1, 'rgba(255,255,200,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c; })());
    this.trail = [];
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xf6ff9a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      sp.renderOrder = 7; scene.add(sp);
      this.trail.push(sp);
    }
    this.trailPos = [];
    // grains projetés aux rebonds
    const dustTex = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return c; })());
    this.dust = [];
    for (let i = 0; i < 48; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, color: 0xd8c9a8, transparent: true, depthWrite: false, opacity: 0 }));
      sp.visible = false; scene.add(sp);
      this.dust.push({ sp, v: new THREE.Vector3(), life: 0, max: 1 });
    }
    this.dustColor = new THREE.Color(0xd8c9a8);
  }

  /** Position de la balle et vitesse : traînée lumineuse au-delà de ~15 m/s. */
  ballTrail(p, speed) {
    this.trailPos.unshift(p.clone());
    if (this.trailPos.length > this.trail.length) this.trailPos.pop();
    const k = THREE.MathUtils.clamp((speed - 14) / 16, 0, 1);
    this.trail.forEach((sp, i) => {
      const q = this.trailPos[i];
      if (!q || k <= 0) { sp.material.opacity = 0; sp.visible = false; return; }
      sp.visible = true;
      sp.position.copy(q);
      const f = 1 - i / this.trail.length;
      sp.scale.setScalar(0.11 * f + 0.03);
      sp.material.opacity = 0.55 * f * k;
    });
  }

  /** Petit nuage de grains (sable du gazon, terre, sable de plage) au rebond. */
  puff(e, strength = 1, color = null) {
    const n = Math.round(4 + strength * 8);
    if (color != null) this.dustColor.set(color);
    for (let i = 0; i < n; i++) {
      const d = this.dust.find((x) => x.life <= 0);
      if (!d) break;
      d.sp.position.set(e.x + (Math.random() - 0.5) * 0.08, 0.03, e.z + (Math.random() - 0.5) * 0.08);
      const a = Math.random() * Math.PI * 2, s = (0.4 + Math.random() * 0.9) * (0.5 + strength);
      d.v.set(Math.cos(a) * s, 0.4 + Math.random() * 1.1 * strength, Math.sin(a) * s);
      d.max = d.life = 0.35 + Math.random() * 0.35;
      d.sp.material.color.copy(this.dustColor);
      d.sp.visible = true;
    }
  }

  setReticle(x, z, visible) {
    this.reticle.position.x = x; this.reticle.position.z = z;
    this.reticleWanted = visible;
  }

  setLanding(pos) {
    if (pos) { this.landing.position.x = pos.x; this.landing.position.z = pos.z; this.landingTarget = 0.85; }
    else this.landingTarget = 0;
  }

  setPlayerRing(pos) {
    if (!pos) { this.playerRing.visible = false; return; }
    this.playerRing.visible = true;
    this.playerRing.position.x = pos.x; this.playerRing.position.z = pos.z;
  }

  impact(e, strength = 1) {
    const w = this.waves.find((x) => x.t >= 1) || this.waves[0];
    const m = w.mesh;
    m.position.set(e.x, e.y, e.z);
    this._n.set(e.nx || 0, e.ny || 0, e.nz || 0);
    m.lookAt(m.position.clone().add(this._n));
    m.position.addScaledVector(this._n, 0.01);
    w.t = 0; w.dur = 0.35 + strength * 0.15; w.size = 0.4 + strength * 0.9;
    m.visible = true;
  }

  update(dt) {
    this._time += dt;
    const a = this.reticleWanted ? 0.8 : 0;
    this.reticleAlpha += (a - this.reticleAlpha) * (1 - Math.exp(-dt * 10));
    this.reticle.visible = this.reticleAlpha > 0.02;
    const pulse = 1 + Math.sin(this._time * 6) * 0.06;
    this.reticle.scale.set(pulse, 1, pulse);
    this.reticleMat.opacity = this.reticleAlpha;
    this.reticleDot.material.opacity = this.reticleAlpha;

    const lm = this.landing.material;
    lm.opacity += (this.landingTarget - lm.opacity) * (1 - Math.exp(-dt * 8));
    this.landing.visible = lm.opacity > 0.02;

    for (const d of this.dust) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.v.y -= 6 * dt; d.v.multiplyScalar(1 - dt * 2.5);
      d.sp.position.addScaledVector(d.v, dt);
      if (d.sp.position.y < 0.01) { d.sp.position.y = 0.01; d.v.y = 0; }
      const f = Math.max(0, d.life / d.max);
      d.sp.material.opacity = 0.55 * f;
      d.sp.scale.setScalar(0.03 + (1 - f) * 0.07);
      if (d.life <= 0) d.sp.visible = false;
    }
    for (const w of this.waves) {
      if (w.t >= 1) continue;
      w.t = Math.min(1, w.t + dt / w.dur);
      const s = 0.1 + w.t * w.size;
      w.mesh.scale.set(s, s, s);
      w.mesh.material.opacity = (1 - w.t) * 0.8;
      if (w.t >= 1) w.mesh.visible = false;
    }
  }
}
