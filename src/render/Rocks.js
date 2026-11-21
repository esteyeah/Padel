// ============================================================================
//  Rochers scannés (Poly Haven, CC0) : vrais volumes et textures photo, posés
//  en instances (une seule géométrie répétée) pour habiller les bords des décors.
// ============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import DATA from '../assets/models/rocks.js';

const LIB = { variants: [] };

export async function loadRocks() {
  if (LIB.variants.length) return;
  const tl = new THREE.TextureLoader(), gl = new GLTFLoader();
  for (const name of ['namaqualand_boulder_04', 'namaqualand_stones_01']) {
    try {
      const g = await gl.loadAsync(DATA[name]);
      const map = tl.load(DATA[name + '_diff']), normalMap = tl.load(DATA[name + '_nor_gl']);
      map.colorSpace = THREE.SRGBColorSpace; map.flipY = false; normalMap.flipY = false;
      const mat = new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.95 });
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
        geo.computeBoundingBox();
        const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
        // centré, posé au sol, taille normalisée à 1 m
        geo.translate(-c.x, -b.min.y, -c.z).scale(1 / Math.max(s.x, s.z), 1 / Math.max(s.x, s.z), 1 / Math.max(s.x, s.z));
        LIB.variants.push({ geo, mat });
      });
    } catch (e) { console.warn('Rochers indisponibles', e); }
  }
}

/** Disperse des rochers : spots [[x, z, taille (m)]] ; posés légèrement enfoncés dans le sol. */
export function rocks(out, spots, y = 0) {
  if (!LIB.variants.length || !spots.length) return;
  const per = LIB.variants.map(() => []);
  spots.forEach((s, i) => per[(i * 7 + Math.floor(s[0] * 13 + s[1] * 3)) % per.length < 0 ? 0 : (i * 7 + Math.abs(Math.floor(s[0] * 13 + s[1] * 3))) % per.length].push(s));
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  LIB.variants.forEach((V, k) => {
    const list = per[k];
    if (!list.length) return;
    const im = new THREE.InstancedMesh(V.geo, V.mat, list.length);
    list.forEach(([x, z, size = 1], i) => {
      e.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.15);
      q.setFromEuler(e);
      const s = size * 1.5 * (0.85 + Math.random() * 0.3);
      M.compose(v.set(x, y - s * 0.12, z), q, sc.set(s, s * (0.8 + Math.random() * 0.4), s));
      im.setMatrixAt(i, M);
    });
    im.castShadow = im.receiveShadow = true;
    out.group.add(im);
  });
}
