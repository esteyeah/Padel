// ============================================================================
//  Ciels photographiques (HDRI Poly Haven, CC0) : fond de ciel et éclairage
//  d'environnement (reflets réalistes sur les vitres, le métal, les peaux).
//  Chargés en arrière-plan : le jeu démarre avec le ciel procédural, puis
//  bascule sur les HDRI dès qu'ils sont prêts.
// ============================================================================
import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

const SOURCES = {
  park: () => import('../assets/hdri/park.exr.js'),
  sky: () => import('../assets/hdri/sky.exr.js'),
  sunrise: () => import('../assets/hdri/sunrise.exr.js'),
  venice: () => import('../assets/hdri/venice.exr.js'),
  night: () => import('../assets/hdri/night.exr.js'),
};

export class SkyBank {
  constructor(renderer) {
    this.renderer = renderer;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.tex = {};        // équirectangulaires (fond)
    this.env = {};        // PMREM (éclairage)
    this.ready = this.loadAll();
  }

  async loadAll() {
    const loader = new EXRLoader();
    await Promise.all(Object.entries(SOURCES).map(async ([k, imp]) => {
      try {
        const url = (await imp()).default;
        const t = await loader.loadAsync(url);
        t.mapping = THREE.EquirectangularReflectionMapping;
        t.colorSpace = THREE.LinearSRGBColorSpace;
        this.tex[k] = t;
        this.env[k] = this.pmrem.fromEquirectangular(t).texture;
      } catch (e) { console.warn('HDRI', k, e); }
    }));
    return this;
  }
}
