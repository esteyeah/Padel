// ============================================================================
//  Scène persistante : ciel, étoiles, brouillard, lumières principales, verre,
//  carte d'environnement (reflets) et ambiances jour / soirée.
//  Le court et son décor dépendent du lieu (voir Venues.js) : setVenue(id).
// ============================================================================
import * as THREE from 'three';
import { COURT, VENUE_RULES } from '../config.js';
import * as TX from './Textures.js';
import { buildVenue, VENUES, courtCount } from './Venues.js';
import { SkyBank } from './Sky.js';

const HW = COURT.halfW, HL = COURT.halfL;

/** Traces sur les vitres : impacts de balle, essuyages, poussière en bas. */
function smudgeTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(10,10,10)'; g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 70; k++) { const x = Math.random() * 512, y = 120 + Math.random() * 300, r = 3 + Math.random() * 9; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(90,90,90,0.8)'); gr.addColorStop(1, 'rgba(90,90,90,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  for (let k = 0; k < 6; k++) { g.strokeStyle = 'rgba(45,45,45,0.3)'; g.lineWidth = 18; g.beginPath(); const x = Math.random() * 512, y = Math.random() * 512; g.arc(x, y, 40 + Math.random() * 60, 0, 2.5); g.stroke(); }
  const d = g.createLinearGradient(0, 380, 0, 512); d.addColorStop(0, 'rgba(70,70,70,0)'); d.addColorStop(1, 'rgba(60,60,60,0.6)'); g.fillStyle = d; g.fillRect(0, 380, 512, 132);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x040914) },
      mid: { value: new THREE.Color(0x15254a) },
      horizon: { value: new THREE.Color(0x5a4256) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.2, h));
        c = mix(c, top, smoothstep(0.2, 0.75, h));
        if (h < 0.0) c = horizon * 0.35;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Positions des projecteurs (sur mâts, de chaque côté du court)
const LAMPS = [];
for (const sx of [-1, 1]) for (const sz of [-1, 1]) LAMPS.push({ x: sx * 5.45, z: sz * 4.2, sx, sz });

export function buildArena(scene, renderer, quality = 'high') {
  const arena = { quality, venue: null };
  const root = new THREE.Group();
  root.name = 'arena';
  scene.add(root);

  // ---------------------------------------------------------------- ciel
  const skyMat = skyMaterial();
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(250, 32, 16), skyMat);
  root.add(skyDome);
  // ciels photographiques (chargés en arrière-plan)
  const skies = new SkyBank(renderer);
  skies.ready.then(() => { arena.hdrReady = true; applyAmbiance(); });
  {
    const N = 600, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = 0.15 + Math.random() * 1.3;
      pos[i * 3] = Math.cos(th) * Math.sin(ph) * 240;
      pos[i * 3 + 1] = Math.cos(ph) * 240;
      pos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * 240;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    arena.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.7, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.8 }));
    root.add(arena.stars);
  }
  scene.fog = new THREE.Fog(0x0d1428, 45, 170);

  // ---------------------------------------------------------------- verre (partagé)
  arena.glassMaterials = {
    high: new THREE.MeshPhysicalMaterial({
      color: 0xf4fffd, metalness: 0, roughness: 0.035, transmission: 1, thickness: 0.012, ior: 1.5,
      specularIntensity: 1, envMapIntensity: 1.3, side: THREE.FrontSide, roughnessMap: smudgeTex(),
    }),
    low: new THREE.MeshPhysicalMaterial({
      color: 0xcfe8ee, metalness: 0.1, roughness: 0.06, transparent: true, opacity: 0.14,
      envMapIntensity: 2.5, side: THREE.FrontSide, depthWrite: false,
    }),
  };
  const ctx = {
    renderer, glassMat: arena.glassMaterials[quality] || arena.glassMaterials.high,
    wireMap: TX.makeWireTexture(renderer), netMap: TX.makeNetTexture(renderer), shared: new Set(),
  };

  // ---------------------------------------------------------------- éclairage principal
  const hemi = new THREE.HemisphereLight(0x8fa6ff, 0x1a1f2a, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff2e0, 1.7);
  key.position.set(3.5, 16, 5);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(quality === 'high' ? 4096 : 2048, quality === 'high' ? 4096 : 2048);
  key.shadow.radius = 3;
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 2, far: 45 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  scene.add(key, key.target);
  arena.keyLight = key;

  // ---------------------------------------------------------------- environnement (reflets)
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  const buildEnv = (day) => {
    const envScene = new THREE.Scene();
    const m = skyMaterial();
    for (const k of ['top', 'mid', 'horizon']) m.uniforms[k].value.copy(skyMat.uniforms[k].value);
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), m));
    if (!day) {
      const glow = new THREE.MeshBasicMaterial({ color: 0xffffff });
      glow.color.multiplyScalar(14);
      for (const L of LAMPS) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), glow);
        p.position.set(L.x, 6.2, L.z);
        p.lookAt(0, 0, 0);
        envScene.add(p);
      }
    } else {
      const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(30) }));
      sun.position.set(20, 35, 12);
      envScene.add(sun);
    }
    const g = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: day ? 0x8a8070 : 0x10151f }));
    g.rotation.x = -Math.PI / 2; g.position.y = -0.5;
    envScene.add(g);
    const court = new THREE.Mesh(new THREE.PlaneGeometry(10, 20), new THREE.MeshBasicMaterial({ color: day ? 0x2f6fb5 : 0x1d4a80 }));
    court.rotation.x = -Math.PI / 2; court.position.y = -0.45;
    envScene.add(court);
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 200);
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = rt.texture;
  };

  // ---------------------------------------------------------------- ambiances
  const AMB = {
    night: {
      sky: [0x040914, 0x15254a, 0x5a4256], fog: [0x0d1428, 45, 170], hemi: [0x8fa6ff, 0x1a1f2a, 0.55],
      key: [0xfff2e0, 1.7, [3.5, 16, 5]], spots: true, lamp: 6, ads: 0.35, windows: 0.55, stars: true, exposure: 1.3, env: 0.55,
    },
    day: {
      sky: [0x2c6fd8, 0x7db3ee, 0xe4edf3], fog: [0xc9d8e8, 80, 260], hemi: [0xd6e6ff, 0x8a8068, 0.75],
      key: [0xfff1dc, 4.4, [13, 13, 8]], spots: false, lamp: 0.3, ads: 0.12, windows: 0.0, stars: false, exposure: 1.0, env: 1.0,
      hdr: { bg: 'sky', env: 'park', bgIntensity: 1.0, envIntensity: 0.9, rot: 0.6 },
    },
    sunset: {
      sky: [0x3b4f86, 0xd98a5a, 0xffc98a], fog: [0xd9a27a, 70, 240], hemi: [0xffd2a8, 0x4a3a30, 0.5],
      key: [0xffb36b, 3.6, [-16, 6.5, 6]], spots: true, lamp: 3, ads: 0.25, windows: 0.4, stars: false, exposure: 1.05, env: 0.9,
      hdr: { bg: 'sunrise', env: 'sunrise', bgIntensity: 0.9, envIntensity: 0.85, rot: 2.2 },
    },
  };
  const applyAmbiance = () => {
    const a = AMB[arena.ambiance] || AMB.night;
    ['top', 'mid', 'horizon'].forEach((k, i) => skyMat.uniforms[k].value.setHex(a.sky[i]));
    scene.fog.color.setHex(a.fog[0]); scene.fog.near = a.fog[1]; scene.fog.far = a.fog[2];
    hemi.color.setHex(a.hemi[0]); hemi.groundColor.setHex(a.hemi[1]); hemi.intensity = a.hemi[2];
    key.color.setHex(a.key[0]); key.intensity = a.key[1]; key.position.set(...a.key[2]);
    arena.stars.visible = a.stars;
    renderer.toneMappingExposure = a.exposure;
    scene.environmentIntensity = a.env;
    // ciel photographique (HDRI) quand il est chargé
    const h = a.hdr && arena.hdrReady ? { ...a.hdr } : null;
    if (h && arena.venue?.id === 'beach' && arena.ambiance === 'day') h.bg = 'venice';
    if (h && skies.tex[h.bg]) {
      scene.background = skies.tex[h.bg];
      scene.backgroundIntensity = h.bgIntensity;
      scene.backgroundRotation.set(0, h.rot, 0);
      scene.backgroundBlurriness = 0.02;
      skyDome.visible = false;
      scene.environment = skies.env[h.env];
      scene.environmentRotation.set(0, h.rot, 0);
      scene.environmentIntensity = h.envIntensity;
      arena.usingHdr = true;
    } else {
      scene.background = null;
      skyDome.visible = true;
      arena.usingHdr = false;
      if (envRT) scene.environment = envRT.texture;
    }
    const v = arena.venue;
    if (v) {
      for (const sp of v.spots) sp.visible = a.spots;
      v.lampMat.emissiveIntensity = a.lamp;
      for (const m of v.adMats) m.emissiveIntensity = a.ads;
      for (const m of v.windows) m.emissiveIntensity = a.windows;
      for (const m of v.emissive) m.emissiveIntensity = a.ads * 2.5;
    }
  };
  arena.ambiance = null;
  arena.setAmbiance = (name = 'night') => {
    if (name === arena.ambiance) return;
    arena.ambiance = name;
    applyAmbiance();
    arena.onAmbiance?.(name);
    buildEnv(name !== 'night');
    applyAmbiance();
  };

  // ---------------------------------------------------------------- lieux
  /** Change de terrain : reconstruit le court et son décor, fixe les règles (portes, extérieur). */
  arena.setVenue = (id, court = 0, club = null) => {
    if (!VENUES[id]) id = 'club';
    const clubKey = id === 'myclub' ? JSON.stringify(club || {}) : '';
    if (arena.venue?.id === id && arena.venue.clubKey === clubKey && arena.venue.court === Math.min(court | 0, courtCount(id, club) - 1)) return arena.venue;
    if (arena.venue) { root.remove(arena.venue.group); arena.venue.dispose(); }
    ctx.glassMat = arena.glassMaterials[arena.quality] || arena.glassMaterials.high;
    ctx.quality = arena.quality;
    const v = buildVenue(id, ctx, court, club);
    v.clubKey = clubKey;
    root.add(v.group);
    arena.venue = v;
    VENUE_RULES.doors = v.def.doors;
    VENUE_RULES.outside = v.def.outside;
    arena.refreshWear();
    // le sac posé au bord du court
    if (arena.bag) v.group.add(arena.bag);
    if (arena.bag) arena.bag.position.set(v.benchSpot.x, 0, v.benchSpot.z);
    applyAmbiance();
    return v;
  };
  arena.venueDef = () => arena.venue?.def;
  /** Nouvelle partie : usure du gazon et traces des vitres à de nouveaux endroits (lieux concernés seulement). */
  const smudge = arena.glassMaterials.high.roughnessMap;
  /** Fête de village : visible (et musique) seulement certaines parties. */
  arena.setParty = (on, sono = false) => {
    for (const g of arena.venue?.parties || []) g.visible = on;
    for (const g of arena.venue?.bands || []) g.visible = !sono;
    for (const g of arena.venue?.sonos || []) g.visible = sono;
  };
  arena.refreshWear = () => {
    const worn = ['beach', 'municipal', 'club'].includes(arena.venue?.id);
    arena.glassMaterials.high.roughnessMap = worn ? smudge : null;
    arena.glassMaterials.high.needsUpdate = true;
    if (worn) { smudge.offset.set(Math.random(), Math.random() * 0.3); smudge.repeat.set(0.8 + Math.random() * 0.5, 1); }
    arena.venue?.redrawWear?.();
    // écrans du hangar : padel ou clips, choisi pour la partie
    arena.venue?.group.traverse((o) => { for (const sc of o.userData.screens || []) sc.mode = Math.random() < 0.5 ? 1 : 0; });
  };

  /** Sac du joueur posé au bord du court (null = aucun). */
  arena.setBag = (obj) => {
    if (arena.bag) arena.bag.parent?.remove(arena.bag);
    arena.bag = obj;
    if (obj && arena.venue) {
      arena.venue.group.add(obj);
      obj.position.set(arena.venue.benchSpot.x, 0, arena.venue.benchSpot.z);
      obj.rotation.y = 0.3;
    }
  };

  /** Public : s'enflamme sur les beaux points (0..1). */
  arena.cheer = (k) => arena.venue?.crowd.cheer(k);
  arena.update = (dt) => {
    const v = arena.venue;
    if (!v) return;
    v.crowd.update(dt);
    for (const a of v.ambient || []) a.update(Math.min(dt, 0.05));
  };

  /** Rend translucides les murs situés entre la caméra et le court. */
  arena.updateWallFade = (camPos, dt) => {
    const walls = arena.venue?.walls;
    if (!walls) return;
    const k = 1 - Math.exp(-dt * 6);
    const out = {
      'back+': camPos.z > HL + 0.3, 'back-': camPos.z < -HL - 0.3,
      'side+': camPos.x > HW + 0.3, 'side-': camPos.x < -HW - 0.3,
    };
    for (const key in walls) {
      const w = walls[key];
      const target = out[key] ? 0.16 : 1;
      if (Math.abs(w.opacity - target) < 0.002) continue;
      w.opacity += (target - w.opacity) * k;
      w.wire.opacity = w.opacity;
      w.frame.opacity = w.opacity;
      w.seam.opacity = w.opacity;
      w.frame.depthWrite = w.opacity > 0.95;
    }
  };

  arena.setGlassQuality = (q) => {
    const m = arena.glassMaterials[q] || arena.glassMaterials.high;
    if (arena.venue) for (const g of arena.venue.glassMeshes) g.material = m;
    ctx.glassMat = m;
    arena.quality = q;
  };

  arena.setVenue('club');
  arena.setAmbiance('night');
  return arena;
}
