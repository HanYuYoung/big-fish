import * as THREE from 'three';
import { G } from './core/globals.js';
import { loadAll } from './core/assets.js';
import { Audio } from './core/audio.js';
import { Ocean } from './world/ocean.js';
import { FX } from './game/fx.js';
import { Game } from './game/game.js';
import { Pipeline } from './render/pipeline.js';
import { speciesKit, FishModel } from './fish/model.js';
import { JellyModel } from './fish/jelly.js';
import { SPECIES } from './fish/species.js';

const Q = new URLSearchParams(location.search);
const tick = () => new Promise((r) => setTimeout(r, 0));
const loadbar = document.getElementById('loadbar');
const progress = (p) => (loadbar.style.width = (p * 100).toFixed(0) + '%');

async function start() {
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  window.__scene = scene;
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.3, 1200);

  await loadAll(renderer, (p) => progress(p * 0.5));
  // paint every species' skin up front
  const ids = [...Object.keys(SPECIES)];
  for (let i = 0; i < ids.length; i++) {
    speciesKit(ids[i]);
    progress(0.5 + (0.35 * (i + 1)) / ids.length);
    if (i % 3 === 2) await tick();
  }

  const ocean = new Ocean(scene);
  const fx = new FX(scene, camera);
  const audio = new Audio();
  const pipe = new Pipeline(renderer, scene, camera);
  const game = new Game({ scene, camera, ocean, fx, audio, pipe });
  window.__game = game;
  progress(0.95);
  await tick();

  let scale = Q.has('scale') ? Number(Q.get('scale')) : 1;
  const resize = () => {
    const pr = Math.min(devicePixelRatio || 1, 1.75) * scale;
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight, false);
    const v = renderer.getDrawingBufferSize(new THREE.Vector2());
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    pipe.setSize(v.x, v.y);
    fx.setPixelRatio(pr);
    ocean.setPixelRatio(pr);
  };
  resize();
  addEventListener('resize', resize);

  // ---- input ----
  const P = game.player;
  addEventListener('pointermove', (e) => game.setPointer(e.clientX, e.clientY));
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    game.setPointer(e.clientX, e.clientY);
    audio.start();
    if (e.pointerType === 'mouse' && e.button === 0) P.wantBoost = true;
  });
  addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') P.wantBoost = false;
  });
  // touch: steer with one finger, a second finger dashes
  canvas.addEventListener('touchstart', (e) => (P.wantBoost = e.touches.length > 1), { passive: true });
  canvas.addEventListener('touchend', (e) => (P.wantBoost = e.touches.length > 1), { passive: true });
  const keys = {};
  const keyVec = () => {
    P.keys.set((keys.r ? 1 : 0) - (keys.l ? 1 : 0), (keys.u ? 1 : 0) - (keys.d ? 1 : 0));
    if (P.keys.lengthSq() > 0) P.useKeys = 1.5;
  };
  const map = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  addEventListener('keydown', (e) => {
    if (map[e.code]) {
      keys[map[e.code]] = true;
      keyVec();
      e.preventDefault();
    }
    if (e.code === 'Space') {
      P.wantBoost = true;
      e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => {
    if (map[e.code]) {
      keys[map[e.code]] = false;
      keyVec();
    }
    if (e.code === 'Space') P.wantBoost = false;
  });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    keyVec();
    P.wantBoost = false;
  });

  // ---- debug / screenshot hooks ----
  if (Q.has('level') || Q.has('play')) {
    game.startGame();
    const lv = Number(Q.get('level') || 1) - 1;
    if (lv > 0) game.loadLevel(lv);
    if (Q.has('size')) {
      P.setSize(Number(Q.get('size')));
      game.buildChain();
    }
  }
  game.god = Q.has('god');
  // ?gallery lines every creature up in front of the camera for inspection
  let gallery = null;
  if (Q.has('gallery')) {
    for (const c of game.creatures) game.removeCreature(c);
    game.creatures = [];
    game.state = 'gallery';
    document.getElementById('title').classList.add('hide');
    const list = Q.get('ids') ? Q.get('ids').split(',') : ['minnow', 'sardine', 'clown', 'tang', 'angel', 'puffer', 'hero', 'parrot', 'lantern', 'hatchet', 'grouper', 'barracuda', 'angler', 'shark', 'jelly'];
    gallery = [];
    let x = -16;
    list.forEach((id, i) => {
      const m = id === 'jelly' ? new JellyModel(0) : new FishModel(id);
      const sz = id === 'jelly' ? 1.6 : Math.min(SPECIES[id].size, Number(Q.get('max') || 3.2)) * (id === 'hero' ? 1.6 : 1);
      m.setSize(sz);
      const per = Number(Q.get('per') || 8);
      const row = i < per ? 0 : 1;
      if (i === per) x = -16;
      m.group.position.set(x + sz / 2, row ? -2.2 : 2.2, 0);
      x += sz + 0.9;
      m.group.rotation.y = Q.get('gallery') === 'side' ? 0 : -0.35;
      scene.add(m.group);
      gallery.push(m);
    });
  }

  renderer.compile(scene, camera);
  let last = performance.now(), frames = 0;
  const perf = { acc: 0, n: 0 };
  function frame() {
    renderer.info.reset();
    const now = performance.now();
    const raw = Math.max(0, (now - last) / 1000);
    const dt = Math.min(raw, 0.05);
    last = now;
    G.uTime.value += dt;
    game.update(dt);
    if (gallery) {
      for (const m of gallery) if (m.U.uPhase) m.U.uPhase.value += dt * 5;
      const gx = Number(Q.get('gx') || 0), gy = Number(Q.get('gy') || 0), gz = Number(Q.get('gz') || 15);
      camera.position.set(gx, gy + 0.6, gz);
      camera.lookAt(gx, gy, 0);
      G.uFogStart.value = 14;
    }
    pipe.render();
    frames++;
    if (frames === 2) {
      document.getElementById('load').classList.add('done');
      window.__ready = true;
    }
    // adaptive resolution
    if (frames > 90 && !Q.has('scale') && !document.hidden) {
      perf.acc += raw;
      if (++perf.n >= 90) {
        const avg = perf.acc / perf.n, old = scale;
        if (avg > 0.022) scale = Math.max(0.6, scale * 0.88);
        else if (avg < 0.0125) scale = Math.min(1, scale * 1.06);
        if (Math.abs(old - scale) > 0.01) resize();
        perf.acc = perf.n = 0;
      }
    }
    if (frames % 30 === 0)
      window.__stats = { fps: Math.round(1 / Math.max(raw, 1e-3)), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, fish: game.creatures.length, size: +P.size.toFixed(2), state: game.state, score: game.score };
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

start().catch((e) => {
  console.error(e);
  window.__error = String((e && e.stack) || e);
});
