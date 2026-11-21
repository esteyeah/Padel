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
  uniforms: { tDiffuse: { value: null }, contrast: { value: 1.08 }, saturation: { value: 1.12 }, tint: { value: new THREE.Vector3(1.0, 1.0, 1.0) }, vignette: { value: 0.28 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; uniform vec3 tint; uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * tint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      vec2 d = vUv - 0.5;
      col *= 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};
const GRADE = {
  day: { contrast: 1.07, saturation: 1.1, tint: [1.0, 1.0, 1.0], vignette: 0.22 },
  sunset: { contrast: 1.1, saturation: 1.15, tint: [1.04, 0.99, 0.93], vignette: 0.32 },
  night: { contrast: 1.1, saturation: 1.12, tint: [0.97, 0.99, 1.04], vignette: 0.34 },
};
import { buildArena } from './Arena.js';

const BLOOM = { night: { strength: 0.42, threshold: 0.82 }, day: { strength: 0.1, threshold: 0.95 }, sunset: { strength: 0.25, threshold: 0.88 } };

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
    this.camera.aspect = w / h;
    // en portrait (mobile), on élargit le champ pour garder le court entier
    this.camera.fov = this.camera.aspect < 1 ? 70 : this.camera.aspect < 1.4 ? 54 : 46;
    this.camera.userData.baseFov = this.camera.fov;
    this.camera.updateProjectionMatrix();
  }

  render(dt = 1 / 60) {
    this.arena.updateWallFade(this.camera.position, dt);
    this.arena.update(dt);
    const c = this.ensureComposer();
    if (c) c.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
