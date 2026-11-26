// ============================================================================
//  Moteur de rendu : WebGLRenderer (ombres douces, tone mapping ACES), scène,
//  caméra, gestion du redimensionnement et des niveaux de qualité.
//  En qualité élevée, un léger halo (bloom) fait rayonner projecteurs, écrans
//  et panneaux LED ; il est plus discret en journée.
// ============================================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

/** Étalonnage « retransmission sportive » : contraste, saturation, légère teinte et vignettage. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, contrast: { value: 1.08 }, saturation: { value: 1.12 }, tint: { value: new THREE.Vector3(1.0, 1.0, 1.0) }, vignette: { value: 0.28 }, time: { value: 0 }, texel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) }, sharpen: { value: 0.35 }, ca: { value: 0.0012 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; uniform vec3 tint; uniform float vignette; uniform float time; uniform vec2 texel; uniform float sharpen; uniform float ca;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // netteté (masque flou) : détails des visages, du grillage et des textures plus nets
      vec3 blur = (texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb
                 + texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb) * 0.25;
      vec3 base = c.rgb + (c.rgb - blur) * sharpen;
      // très légère aberration chromatique sur les bords (objectif de caméra)
      vec2 dc = (vUv - 0.5) * ca * dot(vUv - 0.5, vUv - 0.5) * 8.0;
      base.r = mix(base.r, texture2D(tDiffuse, vUv + dc).r, 0.6);
      base.b = mix(base.b, texture2D(tDiffuse, vUv - dc).b, 0.6);
      vec3 col = max(base, 0.0) * tint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      // courbe en S douce (contraste façon pellicule) plutôt qu'un contraste linéaire
      vec3 s = col * col * (3.0 - 2.0 * col);
      col = mix(col, s, (contrast - 1.0) * 2.5);
      // ombres légèrement froides, hautes lumières légèrement chaudes (rendu caméra)
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col += (1.0 - lum) * vec3(-0.006, 0.0, 0.012) + lum * vec3(0.01, 0.004, -0.008);
      // grain très léger
      float n = fract(sin(dot(vUv * 1000.0 + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      col += n * 0.012;
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};
const GRADE = {
  day: { contrast: 1.09, saturation: 1.05, tint: [1.02, 1.0, 0.97], vignette: 0.2 },
  sunset: { contrast: 1.08, saturation: 1.05, tint: [1.04, 0.99, 0.93], vignette: 0.3 },
  night: { contrast: 1.08, saturation: 1.0, tint: [0.97, 0.99, 1.04], vignette: 0.32 },
};
import { buildArena } from './Arena.js';

const BLOOM = { night: { strength: 0.45, threshold: 0.8 }, day: { strength: 0.14, threshold: 0.92 }, sunset: { strength: 0.34, threshold: 0.82 } };

export class Renderer3D {
  constructor(canvas, { quality = 'high' } = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
    this.camera.position.set(0, 7.5, 17.5);
    this.camera.lookAt(0, 0.4, -0.5);

    this.quality = quality;
    this.arena = buildArena(this.scene, this.renderer, quality);
    this.arena.onAmbiance = (name) => this.applyBloom(name);
    this.composer = null;
    this.applyPixelRatio();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  /** Chaîne de post-traitement (qualité élevée uniquement), créée à la demande. */
  ensureComposer() {
    if (this.quality !== 'high') return null;
    if (this.composer) return this.composer;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    // cible multi-échantillonnée : on garde l'anticrénelage malgré le post-traitement
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(this.renderer, target);
    c.addPass(new RenderPass(this.scene, this.camera));
    // occlusion ambiante : ombres douces dans les recoins (pieds au sol, angles, dessous des bancs)
    try {
      this.ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.ao.output = GTAOPass.OUTPUT.Default;
      this.ao.blendIntensity = 0.85;
      this.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      // la passe d'occlusion ignore la découpe (alpha-test) des feuilles, du grillage, du filet :
      // on masque ces objets pendant cette passe, sinon leurs cartes pleines créent des ombres fantômes
      const ao = this.ao, scene = this.scene;
      let cut = [], frame = 0;
      const orig = ao.render.bind(ao);
      ao.render = (...args) => {
        if (frame++ % 90 === 0) {
          cut = [];
          scene.traverse((o) => {
            const m = o.material;
            if (!m) return;
            const ms = Array.isArray(m) ? m : [m];
            if (ms.some((x) => x.alphaTest > 0 || x.transparent || x.transmission > 0)) cut.push(o);
          });
        }
        const vis = cut.map((o) => o.visible);
        for (const o of cut) o.visible = false;
        orig(...args);
        cut.forEach((o, i) => { o.visible = vis[i]; });
      };
      c.addPass(this.ao);
    } catch (e) { console.warn('GTAO indisponible', e); }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.4, 0.5, 0.85);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.texel.value.set(1 / size.x, 1 / size.y);
    c.addPass(this.grade);
    this.composer = c;
    this.applyBloom(this.arena.ambiance);
    return c;
  }

  applyBloom(name) {
    if (!this.bloom) return;
    const b = BLOOM[name] || BLOOM.night;
    this.bloom.strength = b.strength;
    this.bloom.threshold = b.threshold;
    const g = GRADE[name] || GRADE.night;
    if (this.grade) {
      const u = this.grade.uniforms;
      u.contrast.value = g.contrast; u.saturation.value = g.saturation; u.vignette.value = g.vignette; u.tint.value.set(...g.tint);
    }
  }

  applyPixelRatio() {
    const max = this.quality === 'high' ? 2 : 1.25;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, max));
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.resize();
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.arena.setGlassQuality(q);
    this.applyPixelRatio();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    if (this.grade) { const pr = this.renderer.getPixelRatio(); this.grade.uniforms.texel.value.set(1 / (w * pr), 1 / (h * pr)); }
    this.camera.aspect = w / h;
    // en portrait (mobile), on élargit le champ pour garder le court entier
    this.camera.fov = this.camera.aspect < 1 ? 70 : this.camera.aspect < 1.4 ? 54 : 46;
    this.camera.userData.baseFov = this.camera.fov;
    this.camera.updateProjectionMatrix();
  }

  /** Vent : les feuillages (arbres, palmiers, haies) se balancent doucement. */
  windPatch() {
    const W = this.wind || (this.wind = { value: 0 });
    this.scene.traverse((o) => {
      const m = o.material;
      if (!m || m.name !== 'foliage' || m.userData.wind) return;
      m.userData.wind = true;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uWind = W;
        sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float wph = 0.0;
          #ifdef USE_INSTANCING
            wph = float(gl_InstanceID) * 1.37;
          #endif
          float wh = clamp(position.y, 0.0, 6.0);
          transformed.x += sin(uWind * 1.3 + wph + position.z * 0.4) * 0.018 * wh;
          transformed.z += sin(uWind * 1.05 + wph * 1.7 + position.x * 0.4) * 0.012 * wh;
          transformed += normal * sin(uWind * 6.0 + position.x * 9.0 + position.y * 7.0 + wph) * 0.012;`);
      };
      m.needsUpdate = true;
    });
  }

  render(dt = 1 / 60) {
    this.arena.updateWallFade(this.camera.position, dt);
    this.arena.update(dt);
    const c = this.ensureComposer();
    this._windT = (this._windT || 0) - 1; if (this._windT <= 0) { this._windT = 120; this.windPatch(); }
    if (this.wind) this.wind.value += dt;
    if (c) { if (this.grade) this.grade.uniforms.time.value = (this.grade.uniforms.time.value + dt * 7.3) % 100; c.render(dt); }
    else this.renderer.render(this.scene, this.camera);
  }
}
