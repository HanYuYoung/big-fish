import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Poly Haven (CC0) sand and rock scans, fetched by tools/fetch-assets.mjs.
// The rock glTFs carry their buffers inline and use a .json name, so they serve as plain JSON.
const BASE = './assets/';
export const TEX = {};
export const MODELS = {};

export async function loadAll(renderer, onProgress) {
  const tl = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (url, srgb) =>
    tl.loadAsync(url).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = aniso;
      return t;
    });
  const jobs = [];
  for (const id of ['coast_sand_01', 'lichen_rock', 'mossy_rock']) {
    TEX[id] = {};
    // our shaders decode sRGB themselves, so colour maps are sampled raw
    jobs.push(tex(`${BASE}tex/${id}_diff.jpg`, false).then((t) => (TEX[id].map = t)));
    jobs.push(tex(`${BASE}tex/${id}_nor_gl.jpg`, false).then((t) => (TEX[id].normalMap = t)));
  }
  const gl = new GLTFLoader();
  for (const id of ['rock_moss_set_01', 'rock_moss_set_02']) jobs.push(gl.loadAsync(`${BASE}models/${id}/${id}.json`).then((g) => (MODELS[id] = g.scene)));
  let done = 0;
  await Promise.all(jobs.map((p) => p.then(() => onProgress(++done / jobs.length))));
}
