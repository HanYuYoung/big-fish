import { Rng } from '../core/rng.js';

// ---------------------------------------------------------------------------
// Every creature: its shape (profile of half-heights along the body, t = 0 at the
// nose, 1 at the tail root, all in body lengths), its fins, how it behaves and how
// its skin is painted. `size` is body length in world units.
// ---------------------------------------------------------------------------

const P = (pts) => pts; // [t, halfHeight] control points

export const SPECIES = {
  hero: {
    name: '小金',
    size: 1,
    profile: P([[0, 0.02], [0.04, 0.11], [0.14, 0.2], [0.34, 0.25], [0.6, 0.22], [0.84, 0.12], [1, 0.07]]),
    wr: 0.5,
    tail: { type: 'flow', span: 0.3, len: 0.42 },
    dorsal: { t0: 0.22, t1: 0.82, h: 0.2, shape: 'flow' },
    anal: { t0: 0.55, t1: 0.86, h: 0.14, shape: 'flow' },
    pectoral: { t: 0.27, len: 0.2 },
    pelvic: { t: 0.36, len: 0.12 },
    eye: { t: 0.13, y: 0.05, r: 0.075, iris: [0.16, 0.08, 0.02] },
    fin: [1.0, 0.55, 0.28], finEdge: [1.0, 0.92, 0.6], finAlpha: 0.82,
    shine: 1, irid: 0.6,
    scaleN: 22, scaleK: 0.45,
    paint: 'hero',
  },
  minnow: {
    name: '银鱼', size: 0.55, points: 10,
    profile: P([[0, 0.015], [0.06, 0.06], [0.25, 0.095], [0.55, 0.085], [0.85, 0.045], [1, 0.03]]),
    wr: 0.55,
    tail: { type: 'fork', span: 0.17, len: 0.24 },
    dorsal: { t0: 0.45, t1: 0.62, h: 0.08, shape: 'tri' },
    anal: { t0: 0.62, t1: 0.78, h: 0.05, shape: 'tri' },
    pectoral: { t: 0.22, len: 0.1 },
    eye: { t: 0.1, y: 0.02, r: 0.045, iris: [0.05, 0.05, 0.08] },
    fin: [0.75, 0.85, 0.95], finEdge: [0.9, 0.95, 1], finAlpha: 0.45,
    shine: 1.6, irid: 1.0,
    ai: { cruise: 2.4, flee: 6.6, school: true, depth: [0.05, 0.8], skittish: 1.4 },
    metal: 0.75, scaleN: 22,
    paint: 'minnow',
  },
  sardine: {
    name: '沙丁鱼', size: 0.8, points: 20,
    profile: P([[0, 0.015], [0.06, 0.07], [0.25, 0.115], [0.55, 0.1], [0.85, 0.05], [1, 0.035]]),
    wr: 0.5,
    tail: { type: 'fork', span: 0.2, len: 0.26 },
    dorsal: { t0: 0.38, t1: 0.55, h: 0.09, shape: 'tri' },
    anal: { t0: 0.66, t1: 0.82, h: 0.05, shape: 'low' },
    pectoral: { t: 0.22, len: 0.11 },
    eye: { t: 0.1, y: 0.025, r: 0.05, iris: [0.05, 0.05, 0.08] },
    fin: [0.6, 0.72, 0.85], finEdge: [0.85, 0.92, 1], finAlpha: 0.45,
    shine: 1.6, irid: 0.9,
    ai: { cruise: 3.0, flee: 7.2, school: true, depth: [0.05, 0.6], skittish: 1.3 },
    metal: 0.7, scaleN: 26,
    paint: 'sardine',
  },
  clown: {
    name: '小丑鱼', size: 0.85, points: 25,
    profile: P([[0, 0.025], [0.05, 0.11], [0.16, 0.18], [0.36, 0.21], [0.62, 0.185], [0.86, 0.1], [1, 0.075]]),
    wr: 0.48,
    tail: { type: 'round', span: 0.2, len: 0.26 },
    dorsal: { t0: 0.24, t1: 0.86, h: 0.12, shape: 'double' },
    anal: { t0: 0.58, t1: 0.86, h: 0.1, shape: 'round' },
    pectoral: { t: 0.27, len: 0.15 },
    pelvic: { t: 0.34, len: 0.1 },
    eye: { t: 0.13, y: 0.05, r: 0.06, iris: [0.55, 0.25, 0.02] },
    fin: [1.0, 0.45, 0.06], finEdge: [0.05, 0.03, 0.03], finAlpha: 0.95,
    shine: 1, irid: 0.25,
    ai: { cruise: 1.6, flee: 5.2, depth: [0.45, 0.95], skittish: 1.0 },
    scaleN: 26, scaleK: 0.3,
    paint: 'clown',
  },
  tang: {
    name: '蓝倒吊', size: 1.25, points: 40,
    profile: P([[0, 0.03], [0.05, 0.14], [0.18, 0.27], [0.4, 0.3], [0.66, 0.25], [0.88, 0.1], [1, 0.06]]),
    wr: 0.32,
    tail: { type: 'lunate', span: 0.24, len: 0.24 },
    dorsal: { t0: 0.16, t1: 0.88, h: 0.08, shape: 'low' },
    anal: { t0: 0.42, t1: 0.88, h: 0.07, shape: 'low' },
    pectoral: { t: 0.3, len: 0.16 },
    eye: { t: 0.15, y: 0.07, r: 0.055, iris: [0.05, 0.05, 0.1] },
    fin: [0.08, 0.2, 0.75], finEdge: [0.02, 0.02, 0.08], finAlpha: 0.95,
    tailCol: [1.0, 0.82, 0.08],
    shine: 1.2, irid: 0.5,
    ai: { cruise: 2.2, flee: 5.6, depth: [0.2, 0.85], skittish: 1.0 },
    scaleN: 34, scaleK: 0.5,
    paint: 'tang',
  },
  angel: {
    name: '皇帝神仙鱼', size: 1.6, points: 60,
    profile: P([[0, 0.03], [0.05, 0.15], [0.2, 0.32], [0.42, 0.37], [0.68, 0.3], [0.9, 0.12], [1, 0.08]]),
    wr: 0.26,
    tail: { type: 'round', span: 0.22, len: 0.2 },
    dorsal: { t0: 0.22, t1: 0.92, h: 0.13, shape: 'sail' },
    anal: { t0: 0.48, t1: 0.92, h: 0.12, shape: 'sail' },
    pectoral: { t: 0.3, len: 0.16 },
    eye: { t: 0.14, y: 0.07, r: 0.05, iris: [0.05, 0.05, 0.1] },
    fin: [1.0, 0.82, 0.12], finEdge: [0.1, 0.3, 0.9], finAlpha: 0.95,
    shine: 1.1, irid: 0.5,
    ai: { cruise: 1.8, flee: 5.0, depth: [0.3, 0.9], skittish: 0.9 },
    scaleN: 30, scaleK: 0.6,
    paint: 'angel',
  },
  puffer: {
    name: '河豚', size: 1.35, points: 70,
    profile: P([[0, 0.05], [0.06, 0.17], [0.22, 0.27], [0.45, 0.29], [0.7, 0.22], [0.9, 0.1], [1, 0.07]]),
    wr: 0.92,
    tail: { type: 'round', span: 0.16, len: 0.2 },
    dorsal: { t0: 0.66, t1: 0.82, h: 0.1, shape: 'round' },
    anal: { t0: 0.66, t1: 0.82, h: 0.08, shape: 'round' },
    pectoral: { t: 0.26, len: 0.13 },
    eye: { t: 0.16, y: 0.1, r: 0.07, iris: [0.25, 0.55, 0.15] },
    fin: [0.95, 0.85, 0.5], finEdge: [0.6, 0.5, 0.25], finAlpha: 0.65,
    shine: 0.8, irid: 0.2,
    puffer: true, noLateral: true,
    ai: { cruise: 1.2, flee: 2.6, depth: [0.4, 0.95], skittish: 0.6 },
    scaleK: 0,
    paint: 'puffer',
  },
  parrot: {
    name: '鹦鹉鱼', size: 2.3, points: 90,
    profile: P([[0, 0.03], [0.05, 0.13], [0.2, 0.22], [0.45, 0.24], [0.72, 0.19], [0.9, 0.1], [1, 0.07]]),
    wr: 0.45,
    tail: { type: 'lunate', span: 0.22, len: 0.24 },
    dorsal: { t0: 0.22, t1: 0.84, h: 0.07, shape: 'low' },
    anal: { t0: 0.6, t1: 0.84, h: 0.07, shape: 'low' },
    pectoral: { t: 0.3, len: 0.15 },
    eye: { t: 0.13, y: 0.07, r: 0.045, iris: [0.85, 0.45, 0.1] },
    fin: [0.95, 0.4, 0.55], finEdge: [0.2, 0.75, 0.95], finAlpha: 0.9,
    shine: 1.2, irid: 0.7,
    ai: { cruise: 2.4, flee: 5.6, depth: [0.3, 0.9], skittish: 0.7 },
    scaleN: 18, scaleK: 1.1,
    paint: 'parrot',
  },
  grouper: {
    name: '石斑鱼', size: 3.3, points: 150,
    profile: P([[0, 0.05], [0.04, 0.15], [0.18, 0.23], [0.42, 0.25], [0.7, 0.2], [0.9, 0.11], [1, 0.085]]),
    wr: 0.55,
    tail: { type: 'round', span: 0.2, len: 0.2 },
    dorsal: { t0: 0.24, t1: 0.86, h: 0.08, shape: 'spiny' },
    anal: { t0: 0.62, t1: 0.86, h: 0.09, shape: 'round' },
    pectoral: { t: 0.3, len: 0.16 },
    pelvic: { t: 0.32, len: 0.1 },
    eye: { t: 0.12, y: 0.09, r: 0.04, iris: [0.7, 0.55, 0.15] },
    fin: [0.55, 0.16, 0.1], finEdge: [0.25, 0.45, 0.85], finAlpha: 0.95,
    shine: 0.7, irid: 0.25,
    mouth: 1.4,
    ai: { cruise: 1.9, flee: 4.6, chase: 6.4, aggro: 9, predator: true, depth: [0.4, 0.95], skittish: 0.5 },
    scaleN: 34, scaleK: 0.9,
    paint: 'grouper',
  },
  barracuda: {
    name: '梭鱼', size: 4.1, points: 220,
    profile: P([[0, 0.012], [0.07, 0.05], [0.2, 0.075], [0.5, 0.08], [0.82, 0.055], [1, 0.035]]),
    wr: 0.7,
    tail: { type: 'fork', span: 0.13, len: 0.16 },
    dorsal: { t0: 0.42, t1: 0.5, h: 0.06, shape: 'tri', second: { t0: 0.72, t1: 0.8, h: 0.05 } },
    anal: { t0: 0.73, t1: 0.81, h: 0.05, shape: 'tri' },
    pectoral: { t: 0.24, len: 0.07 },
    eye: { t: 0.09, y: 0.02, r: 0.02, iris: [0.75, 0.7, 0.35] },
    fin: [0.45, 0.48, 0.52], finEdge: [0.12, 0.12, 0.14], finAlpha: 0.9,
    shine: 1.6, irid: 0.5,
    teeth: true,
    ai: { cruise: 3.4, flee: 7, chase: 10, aggro: 11, predator: true, burst: true, depth: [0.1, 0.8], skittish: 0.4 },
    metal: 0.6, scaleN: 60,
    paint: 'barracuda',
  },
  lantern: {
    name: '灯笼鱼', size: 0.75, points: 30,
    profile: P([[0, 0.03], [0.06, 0.11], [0.22, 0.14], [0.55, 0.12], [0.85, 0.06], [1, 0.045]]),
    wr: 0.5,
    tail: { type: 'fork', span: 0.17, len: 0.22 },
    dorsal: { t0: 0.38, t1: 0.55, h: 0.08, shape: 'tri' },
    anal: { t0: 0.6, t1: 0.82, h: 0.06, shape: 'low' },
    pectoral: { t: 0.24, len: 0.1 },
    eye: { t: 0.11, y: 0.03, r: 0.07, iris: [0.1, 0.25, 0.4] },
    fin: [0.15, 0.2, 0.3], finEdge: [0.3, 0.5, 0.7], finAlpha: 0.5,
    shine: 1.4, irid: 0.8,
    glow: [0.8, 2.2, 4.0],
    ai: { cruise: 2.0, flee: 5.6, school: true, depth: [0.1, 0.95], skittish: 1.2 },
    metal: 0.35, scaleN: 18, scaleK: 1.2,
    paint: 'lantern',
  },
  hatchet: {
    name: '银斧鱼', size: 1.0, points: 50,
    profile: P([[0, 0.03], [0.06, 0.16], [0.2, 0.3], [0.38, 0.3], [0.6, 0.17], [0.82, 0.06], [1, 0.045]]),
    center: P([[0, 0.05], [0.2, -0.02], [0.4, -0.04], [0.7, 0.02], [1, 0.03]]),
    wr: 0.22,
    tail: { type: 'fork', span: 0.14, len: 0.2 },
    dorsal: { t0: 0.45, t1: 0.6, h: 0.06, shape: 'tri' },
    anal: { t0: 0.62, t1: 0.8, h: 0.05, shape: 'low' },
    pectoral: { t: 0.26, len: 0.12 },
    eye: { t: 0.12, y: 0.1, r: 0.08, iris: [0.2, 0.3, 0.35] },
    fin: [0.6, 0.7, 0.8], finEdge: [0.85, 0.9, 1], finAlpha: 0.4,
    shine: 2.0, irid: 1.0,
    glow: [1.0, 2.4, 4.2],
    ai: { cruise: 1.8, flee: 5.0, depth: [0.15, 0.9], skittish: 1.0 },
    metal: 0.85, scaleN: 16,
    paint: 'hatchet',
  },
  angler: {
    name: '鮟鱇鱼', size: 4.6, points: 400,
    profile: P([[0, 0.12], [0.04, 0.27], [0.18, 0.33], [0.38, 0.27], [0.62, 0.18], [0.86, 0.1], [1, 0.07]]),
    center: P([[0, 0.03], [0.3, 0.02], [1, 0.0]]),
    wr: 0.75,
    tail: { type: 'round', span: 0.15, len: 0.16 },
    dorsal: { t0: 0.6, t1: 0.8, h: 0.07, shape: 'round' },
    anal: { t0: 0.66, t1: 0.82, h: 0.06, shape: 'round' },
    pectoral: { t: 0.38, len: 0.14 },
    eye: { t: 0.15, y: 0.17, r: 0.03, iris: [0.6, 0.65, 0.4] },
    fin: [0.2, 0.13, 0.1], finEdge: [0.4, 0.3, 0.25], finAlpha: 0.85,
    shine: 0.6, irid: 0.2,
    mouth: 2.2, teeth: true, lure: true, noLateral: true,
    ai: { cruise: 1.1, flee: 4.5, chase: 5.4, aggro: 8, predator: true, depth: [0.4, 1.0], skittish: 0.3 },
    scaleK: 0,
    paint: 'angler',
  },
  shark: {
    name: '鲨鱼', size: 7.5, points: 0,
    profile: P([[0, 0.02], [0.06, 0.08], [0.22, 0.13], [0.45, 0.13], [0.72, 0.08], [0.92, 0.035], [1, 0.03]]),
    center: P([[0, -0.01], [0.4, 0.0], [1, 0.02]]),
    wr: 0.78,
    tail: { type: 'shark', span: 0.24, len: 0.24 },
    dorsal: { t0: 0.34, t1: 0.52, h: 0.17, shape: 'shark', second: { t0: 0.8, t1: 0.86, h: 0.04 } },
    anal: { t0: 0.8, t1: 0.86, h: 0.03, shape: 'tri' },
    pectoral: { t: 0.3, len: 0.22, big: true },
    eye: { t: 0.1, y: 0.03, r: 0.012, iris: [0.02, 0.02, 0.02] },
    fin: [0.35, 0.4, 0.46], finEdge: [0.22, 0.25, 0.3], finAlpha: 1,
    shine: 0.9, irid: 0.1,
    gills: true, smooth: true,
    ai: { cruise: 3.6, flee: 6, chase: 8.4, aggro: 14, predator: true, depth: [0.1, 0.8], skittish: 0, never: true },
    scaleK: 0,
    paint: 'shark',
  },
  // ---- 沉船湾 ----
  butterfly: {
    name: '蝴蝶鱼', size: 0.95, points: 35,
    profile: P([[0, 0.015], [0.06, 0.08], [0.2, 0.29], [0.42, 0.34], [0.68, 0.28], [0.9, 0.1], [1, 0.07]]),
    wr: 0.24,
    tail: { type: 'round', span: 0.17, len: 0.2 },
    dorsal: { t0: 0.2, t1: 0.9, h: 0.1, shape: 'round' },
    anal: { t0: 0.5, t1: 0.9, h: 0.09, shape: 'round' },
    pectoral: { t: 0.3, len: 0.13 },
    eye: { t: 0.15, y: 0.06, r: 0.05, iris: [0.05, 0.05, 0.05] },
    fin: [1.0, 0.86, 0.12], finEdge: [0.08, 0.08, 0.1], finAlpha: 0.95,
    shine: 1.1, irid: 0.4, scaleN: 26, scaleK: 0.5,
    ai: { cruise: 1.8, flee: 5.4, depth: [0.35, 0.95], skittish: 1.0 },
    paint: 'butterfly',
  },
  lionfish: {
    name: '狮子鱼', size: 1.9, points: 120,
    profile: P([[0, 0.03], [0.05, 0.13], [0.2, 0.2], [0.45, 0.2], [0.75, 0.14], [0.92, 0.08], [1, 0.06]]),
    wr: 0.5,
    tail: { type: 'round', span: 0.18, len: 0.22 },
    dorsal: { t0: 0.16, t1: 0.86, h: 0.36, shape: 'quills' },
    anal: { t0: 0.6, t1: 0.86, h: 0.12, shape: 'round' },
    pectoral: { t: 0.27, len: 0.3, big: true },
    pelvic: { t: 0.33, len: 0.14 },
    eye: { t: 0.12, y: 0.07, r: 0.045, iris: [0.6, 0.2, 0.1] },
    fin: [0.85, 0.32, 0.22], finEdge: [1.0, 0.92, 0.86], finAlpha: 0.75,
    shine: 0.9, irid: 0.3, scaleN: 30, scaleK: 0.4,
    venom: true,
    ai: { cruise: 0.9, flee: 3.6, depth: [0.4, 0.95], skittish: 0.4 },
    paint: 'lionfish',
  },
  moray: {
    name: '海鳗', size: 4.3, points: 260,
    profile: P([[0, 0.012], [0.03, 0.04], [0.08, 0.06], [0.2, 0.068], [0.5, 0.064], [0.8, 0.046], [1, 0.018]]),
    wr: 0.6,
    tail: { type: 'round', span: 0.045, len: 0.05 },
    dorsal: { t0: 0.1, t1: 0.99, h: 0.032, shape: 'low' },
    anal: { t0: 0.5, t1: 0.99, h: 0.028, shape: 'low' },
    pectoral: { t: 0.14, len: 0.025 },
    eye: { t: 0.045, y: 0.032, r: 0.012, iris: [0.8, 0.75, 0.2] },
    fin: [0.32, 0.36, 0.14], finEdge: [0.55, 0.6, 0.25], finAlpha: 1,
    shine: 0.7, irid: 0.2, scaleK: 0, noLateral: true,
    mouth: 1.4, teeth: true,
    wave: { k: 12, stiff: 0.03, amp: 1.5 },
    ai: { cruise: 1.5, flee: 4.5, chase: 7.4, aggro: 8, predator: true, burst: true, depth: [0.72, 1.0], skittish: 0.3 },
    paint: 'moray',
  },
  // ---- 冰封极海 ----
  capelin: {
    name: '毛鳞鱼', size: 0.6, points: 12,
    profile: P([[0, 0.012], [0.06, 0.055], [0.25, 0.09], [0.55, 0.08], [0.85, 0.042], [1, 0.03]]),
    wr: 0.55,
    tail: { type: 'fork', span: 0.17, len: 0.24 },
    dorsal: { t0: 0.44, t1: 0.58, h: 0.08, shape: 'tri' },
    anal: { t0: 0.64, t1: 0.82, h: 0.05, shape: 'low' },
    pectoral: { t: 0.22, len: 0.12 },
    eye: { t: 0.1, y: 0.02, r: 0.045, iris: [0.05, 0.05, 0.08] },
    fin: [0.62, 0.72, 0.7], finEdge: [0.9, 0.95, 0.95], finAlpha: 0.45,
    shine: 1.6, irid: 1.0, metal: 0.75, scaleN: 22,
    ai: { cruise: 2.5, flee: 6.6, school: true, depth: [0.05, 0.8], skittish: 1.4 },
    paint: 'capelin',
  },
  icefish: {
    name: '冰鱼', size: 1.25, points: 45,
    profile: P([[0, 0.012], [0.07, 0.05], [0.2, 0.1], [0.42, 0.12], [0.7, 0.09], [0.9, 0.05], [1, 0.038]]),
    wr: 0.62,
    tail: { type: 'round', span: 0.15, len: 0.2 },
    dorsal: { t0: 0.28, t1: 0.42, h: 0.17, shape: 'sail', second: { t0: 0.5, t1: 0.9, h: 0.07 } },
    anal: { t0: 0.5, t1: 0.9, h: 0.07, shape: 'low' },
    pectoral: { t: 0.24, len: 0.2 },
    pelvic: { t: 0.22, len: 0.16 },
    eye: { t: 0.11, y: 0.05, r: 0.05, iris: [0.25, 0.3, 0.32] },
    fin: [0.85, 0.92, 0.98], finEdge: [0.2, 0.25, 0.3], finAlpha: 0.55,
    shine: 1.8, irid: 0.9, scaleK: 0, metal: 0.25,
    ai: { cruise: 1.6, flee: 5.4, depth: [0.3, 0.95], skittish: 1.0 },
    paint: 'icefish',
  },
  cod: {
    name: '鳕鱼', size: 2.2, points: 100,
    profile: P([[0, 0.035], [0.05, 0.12], [0.2, 0.19], [0.42, 0.2], [0.7, 0.14], [0.9, 0.07], [1, 0.05]]),
    wr: 0.6,
    tail: { type: 'round', span: 0.17, len: 0.18 },
    dorsal: { t0: 0.3, t1: 0.45, h: 0.09, shape: 'round', second: { t0: 0.5, t1: 0.66, h: 0.08 } },
    anal: { t0: 0.52, t1: 0.82, h: 0.07, shape: 'low' },
    pectoral: { t: 0.27, len: 0.15 },
    pelvic: { t: 0.24, len: 0.1 },
    eye: { t: 0.12, y: 0.06, r: 0.04, iris: [0.55, 0.5, 0.25] },
    fin: [0.48, 0.45, 0.3], finEdge: [0.75, 0.72, 0.55], finAlpha: 0.9,
    shine: 0.9, irid: 0.3, scaleN: 40, scaleK: 0.6,
    ai: { cruise: 1.8, flee: 5.0, depth: [0.4, 1.0], skittish: 0.7 },
    paint: 'cod',
  },
  salmon: {
    name: '三文鱼', size: 3.1, points: 170,
    profile: P([[0, 0.025], [0.05, 0.1], [0.2, 0.16], [0.45, 0.17], [0.72, 0.12], [0.9, 0.06], [1, 0.045]]),
    wr: 0.55,
    tail: { type: 'lunate', span: 0.18, len: 0.2 },
    dorsal: { t0: 0.38, t1: 0.52, h: 0.1, shape: 'tri' },
    anal: { t0: 0.7, t1: 0.82, h: 0.07, shape: 'tri' },
    pectoral: { t: 0.24, len: 0.12 },
    pelvic: { t: 0.5, len: 0.08 },
    eye: { t: 0.1, y: 0.04, r: 0.03, iris: [0.6, 0.55, 0.4] },
    fin: [0.5, 0.52, 0.55], finEdge: [0.3, 0.32, 0.35], finAlpha: 0.9,
    shine: 1.6, irid: 0.8, metal: 0.55, scaleN: 50,
    ai: { cruise: 3.0, flee: 6.8, chase: 6.5, aggro: 7, predator: true, burst: true, depth: [0.1, 0.8], skittish: 0.5 },
    paint: 'salmon',
  },
  sleeper: {
    name: '格陵兰睡鲨', size: 5.3, points: 480,
    profile: P([[0, 0.03], [0.06, 0.1], [0.24, 0.14], [0.48, 0.14], [0.74, 0.09], [0.92, 0.04], [1, 0.035]]),
    center: P([[0, -0.01], [0.4, 0.0], [1, 0.02]]),
    wr: 0.85,
    tail: { type: 'shark', span: 0.2, len: 0.2 },
    dorsal: { t0: 0.48, t1: 0.58, h: 0.06, shape: 'round', second: { t0: 0.7, t1: 0.78, h: 0.05 } },
    anal: { t0: 0.8, t1: 0.86, h: 0.02, shape: 'tri' },
    pectoral: { t: 0.27, len: 0.14, big: true },
    eye: { t: 0.08, y: 0.04, r: 0.014, iris: [0.55, 0.6, 0.62] },
    fin: [0.3, 0.29, 0.28], finEdge: [0.2, 0.19, 0.18], finAlpha: 1,
    shine: 0.6, irid: 0.1, scaleK: 0, smooth: true,
    gills: true,
    ai: { cruise: 1.2, flee: 4, chase: 5.2, aggro: 8, predator: true, depth: [0.3, 1.0], skittish: 0 },
    paint: 'sleeper',
  },
  // ---- 熔岩海沟 ----
  viper: {
    name: '蝰鱼', size: 1.7, points: 95,
    profile: P([[0, 0.03], [0.04, 0.085], [0.14, 0.1], [0.4, 0.085], [0.8, 0.05], [1, 0.032]]),
    wr: 0.5,
    tail: { type: 'fork', span: 0.12, len: 0.16 },
    dorsal: { t0: 0.24, t1: 0.3, h: 0.12, shape: 'tri' },
    anal: { t0: 0.8, t1: 0.9, h: 0.06, shape: 'tri' },
    pectoral: { t: 0.2, len: 0.09 },
    eye: { t: 0.08, y: 0.04, r: 0.035, iris: [0.25, 0.55, 0.6] },
    fin: [0.12, 0.14, 0.2], finEdge: [0.3, 0.45, 0.6], finAlpha: 0.7,
    shine: 1.8, irid: 1.2, metal: 0.35, scaleK: 0, noLateral: true,
    teeth: true, fangs: true, mouth: 1.3,
    glow: [0.9, 2.6, 4.2],
    ai: { cruise: 1.8, flee: 5.2, chase: 6.0, aggro: 6, predator: true, burst: true, depth: [0.1, 1.0], skittish: 0.5 },
    paint: 'viper',
  },
  megalodon: {
    name: '巨齿鲨', size: 6.6, points: 1500,
    profile: P([[0, 0.025], [0.06, 0.1], [0.22, 0.15], [0.45, 0.15], [0.72, 0.09], [0.92, 0.038], [1, 0.032]]),
    center: P([[0, -0.015], [0.4, 0.0], [1, 0.02]]),
    wr: 0.8,
    tail: { type: 'shark', span: 0.26, len: 0.24 },
    dorsal: { t0: 0.32, t1: 0.5, h: 0.18, shape: 'shark', second: { t0: 0.8, t1: 0.86, h: 0.04 } },
    anal: { t0: 0.8, t1: 0.86, h: 0.03, shape: 'tri' },
    pectoral: { t: 0.3, len: 0.24, big: true },
    eye: { t: 0.09, y: 0.035, r: 0.011, iris: [0.02, 0.02, 0.02] },
    fin: [0.3, 0.34, 0.4], finEdge: [0.2, 0.23, 0.28], finAlpha: 1,
    shine: 0.9, irid: 0.1, scaleK: 0, smooth: true,
    gills: true, teeth: true, mouth: 1.6,
    ai: { cruise: 2.8, flee: 6, chase: 6.8, aggro: 10, predator: true, depth: [0.1, 0.9], skittish: 0 },
    paint: 'megalodon',
  },
};

// smooth profile lookup (Catmull-Rom through the control points)
export function sampleProfile(pts, t) {
  if (!pts) return 0;
  t = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < pts.length - 2 && t > pts[i + 1][0]) i++;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
  const u = (t - p1[0]) / Math.max(1e-5, p2[0] - p1[0]);
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  return Math.max(0.004, cr(p0[1], p1[1], p2[1], p3[1]));
}

// ---------------------------------------------------------------------------
// skin painting: a side-on texture projected onto both flanks.
// x runs nose (0) -> tail root (W); y runs back (0) -> belly (H).
// ---------------------------------------------------------------------------
export const TEX_W = 512, TEX_H = 256;

function maxHalf(sp) {
  let m = 0;
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    m = Math.max(m, sampleProfile(sp.profile, t) + Math.abs(centerOff(sp, t)));
  }
  return m * 1.08;
}
function centerOff(sp, t) {
  return sp.center ? sampleCenter(sp.center, t) : 0;
}
function sampleCenter(pts, t) {
  t = Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < pts.length - 2 && t > pts[i + 1][0]) i++;
  const a = pts[i], b = pts[i + 1];
  const u = (t - a[0]) / Math.max(1e-5, b[0] - a[0]);
  const s = u * u * (3 - 2 * u);
  return a[1] + (b[1] - a[1]) * s;
}
export { sampleCenter, maxHalf };

export function paintSkin(sp, seed = 1) {
  const W = TEX_W, H = TEX_H;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const glow = document.createElement('canvas');
  glow.width = W;
  glow.height = H;
  const gg = glow.getContext('2d');
  gg.fillStyle = '#000';
  gg.fillRect(0, 0, W, H);
  const M = maxHalf(sp);
  // helpers in texture space
  const X = (t) => t * W;
  const Yc = (t) => H / 2 - (centerOff(sp, t) / M) * (H / 2);
  const Hh = (t) => (sampleProfile(sp.profile, t) / M) * (H / 2);
  const top = (t) => Yc(t) - Hh(t);
  const bot = (t) => Yc(t) + Hh(t);
  const rng = new Rng(seed * 977 + 13);
  const ctx = { g, gg, W, H, X, Yc, Hh, top, bot, rng, sp };
  const vgrad = (c0, c1, c2) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, c0);
    gr.addColorStop(0.5, c1);
    gr.addColorStop(1, c2);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  };
  ctx.vgrad = vgrad;
  ctx.band = (t0, t1, color, wobble = 0.02) => {
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i <= 20; i++) {
      const y = (i / 20) * H;
      const w = Math.sin(i * 0.7 + t0 * 30) * wobble * W;
      if (i === 0) g.moveTo(X(t0) + w, y);
      else g.lineTo(X(t0) + w, y);
    }
    for (let i = 20; i >= 0; i--) {
      const y = (i / 20) * H;
      const w = Math.sin(i * 0.7 + t1 * 30) * wobble * W;
      g.lineTo(X(t1) + w, y);
    }
    g.fill();
  };
  ctx.scales = (alpha = 0.12, size = 10) => {
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = '#000';
    g.lineWidth = 1.2;
    for (let y = -size; y < H + size; y += size * 0.75) {
      const off = (Math.round(y / (size * 0.75)) % 2) * size * 0.5;
      for (let x = W * 0.12 + off; x < W; x += size) {
        g.beginPath();
        g.arc(x, y, size * 0.6, Math.PI * 0.6, Math.PI * 1.4);
        g.stroke();
      }
    }
    g.restore();
  };
  ctx.dots = (n, rMin, rMax, color, yMin = 0, yMax = 1, tMin = 0.05, tMax = 0.95) => {
    g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const t = rng.range(tMin, tMax);
      const y = top(t) + (bot(t) - top(t)) * rng.range(yMin, yMax);
      g.beginPath();
      g.arc(X(t), y, rng.range(rMin, rMax), 0, Math.PI * 2);
      g.fill();
    }
  };
  ctx.line = (fn, width, color, t0 = 0.05, t1 = 1) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = t0 + ((t1 - t0) * i) / 40;
      const y = fn(t);
      if (i === 0) g.moveTo(X(t), y);
      else g.lineTo(X(t), y);
    }
    g.stroke();
  };
  ctx.photophores = (n, row, color = '#bff') => {
    for (let i = 0; i < n; i++) {
      const t = 0.12 + (i / n) * 0.78;
      const y = top(t) + (bot(t) - top(t)) * row;
      g.fillStyle = '#9cf';
      g.beginPath();
      g.arc(X(t), y, 4, 0, Math.PI * 2);
      g.fill();
      gg.fillStyle = color;
      gg.beginPath();
      gg.arc(X(t), y, 6, 0, Math.PI * 2);
      gg.fill();
    }
  };
  PAINTERS[sp.paint](ctx);
  if (!sp.smooth) finishSkin(ctx);
  // a soft gill line and mouth crease shared by everyone
  if (!sp.gills) {
    g.save();
    g.globalAlpha = 0.28;
    g.strokeStyle = '#000';
    g.lineWidth = 3;
    g.beginPath();
    const gt = 0.21;
    g.moveTo(X(gt) - 6, top(gt) + Hh(gt) * 0.45);
    g.quadraticCurveTo(X(gt) + 8, Yc(gt), X(gt) - 2, bot(gt) - Hh(gt) * 0.35);
    g.stroke();
    g.restore();
  }
  return { skin: cv, glow };
}

// shared finishing touches: countershading, a lateral line, faint mottling and a
// darker snout, so every flank reads as a rounded, living body
function finishSkin({ g, W, H, X, Yc, Hh, top, bot, rng, sp }) {
  g.save();
  g.globalCompositeOperation = 'multiply';
  const dark = g.createLinearGradient(0, 0, 0, H);
  dark.addColorStop(0, 'rgba(40,50,70,0.55)');
  dark.addColorStop(0.32, 'rgba(255,255,255,0)');
  dark.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = dark;
  g.fillRect(0, 0, W, H);
  // the head is a touch darker than the flank
  const head = g.createLinearGradient(0, 0, X(0.25), 0);
  head.addColorStop(0, 'rgba(120,110,120,0.5)');
  head.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = head;
  g.fillRect(0, 0, X(0.25), H);
  g.globalCompositeOperation = 'screen';
  const belly = g.createLinearGradient(0, H * 0.6, 0, H);
  belly.addColorStop(0, 'rgba(0,0,0,0)');
  belly.addColorStop(1, 'rgba(120,120,110,0.45)');
  g.fillStyle = belly;
  g.fillRect(0, H * 0.6, W, H * 0.4);
  g.globalCompositeOperation = 'source-over';
  // mottling
  for (let i = 0; i < 260; i++) {
    const t = rng.range(0, 1), y = top(t) + (bot(t) - top(t)) * rng.range(0, 1);
    g.fillStyle = rng.next() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    g.beginPath();
    g.ellipse(X(t), y, rng.range(3, 12), rng.range(2, 6), 0, 0, Math.PI * 2);
    g.fill();
  }
  // lateral line: a row of fine pores arching over the flank
  if (!sp.noLateral) {
    for (let i = 0; i < 46; i++) {
      const t = 0.24 + (i / 46) * 0.74;
      const y = Yc(t) - Hh(t) * (0.32 - 0.25 * t);
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(X(t), y, 3, 1.6);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(X(t), y + 1.6, 3, 1);
    }
  }
  g.restore();
}

const PAINTERS = {
  hero({ g, vgrad, scales, line, Yc, Hh, X, H, band, top, bot, dots }) {
    vgrad('#ff7b2e', '#ffc23a', '#fff1c4');
    // a warm coral saddle and a pale stripe behind the eye
    g.globalAlpha = 0.55;
    band(0.42, 0.6, '#ff5a3c', 0.01);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.ellipse(X(0.22), Yc(0.22), 11, Hh(0.22) * 0.95, 0, 0, Math.PI * 2);
    g.fill();
    scales(0.1, 12);
    line((t) => Yc(t) - Hh(t) * 0.2, 2, 'rgba(255,255,255,0.35)', 0.25, 0.95);
    // blush on the cheek
    g.fillStyle = 'rgba(255,90,90,0.35)';
    g.beginPath();
    g.ellipse(X(0.1), Yc(0.1) + Hh(0.1) * 0.45, 10, 6, 0, 0, Math.PI * 2);
    g.fill();
  },
  minnow({ g, vgrad, line, Yc, Hh, scales }) {
    vgrad('#4d6f86', '#c8dbe6', '#f4f9fb');
    line((t) => Yc(t) - Hh(t) * 0.05, 5, 'rgba(210,235,255,0.9)', 0.15, 1);
    line((t) => Yc(t) - Hh(t) * 0.05, 2, 'rgba(60,90,120,0.6)', 0.15, 1);
    scales(0.06, 7);
  },
  sardine({ g, vgrad, line, Yc, Hh, X, top, bot, scales }) {
    vgrad('#1f4f8a', '#a9c6df', '#f1f6fa');
    line((t) => Yc(t) - Hh(t) * 0.35, 3, 'rgba(255,255,255,0.4)', 0.15, 1);
    g.fillStyle = 'rgba(20,30,60,0.75)';
    for (let i = 0; i < 6; i++) {
      const t = 0.24 + i * 0.07;
      g.beginPath();
      g.arc(X(t), Yc(t) - Hh(t) * 0.15, 4, 0, Math.PI * 2);
      g.fill();
    }
    scales(0.08, 8);
  },
  clown({ g, vgrad, band, scales }) {
    vgrad('#ff6a00', '#ff7f12', '#ff9a3c');
    // white bands with black outlines
    for (const [a, b] of [[0.16, 0.25], [0.46, 0.58], [0.84, 0.92]]) {
      band(a - 0.018, b + 0.018, '#111', 0.012);
      band(a, b, '#fbfbfb', 0.012);
    }
    scales(0.05, 9);
  },
  tang({ g, vgrad, X, Yc, Hh, top, bot, W, H }) {
    vgrad('#1647c9', '#1d5ae0', '#3b7cff');
    // the black "palette" marking
    g.fillStyle = '#0a0d1e';
    g.beginPath();
    g.moveTo(X(0.18), top(0.18) + Hh(0.18) * 0.25);
    g.bezierCurveTo(X(0.45), top(0.4) - 4, X(0.75), top(0.7) + 2, X(0.98), Yc(0.98) - 2);
    g.bezierCurveTo(X(0.8), Yc(0.7) + Hh(0.7) * 0.25, X(0.6), Yc(0.5) + Hh(0.5) * 0.15, X(0.45), Yc(0.45) + Hh(0.45) * 0.45);
    g.bezierCurveTo(X(0.35), Yc(0.4) + Hh(0.4) * 0.1, X(0.25), Yc(0.3) - Hh(0.3) * 0.1, X(0.18), top(0.18) + Hh(0.18) * 0.25);
    g.fill();
    g.fillStyle = '#ffd21a';
    g.fillRect(X(0.94), 0, W, H);
  },
  angel({ g, vgrad, X, Yc, Hh, top, bot, W, H }) {
    vgrad('#0d2a8c', '#1a3fae', '#2554c9');
    // curved yellow pinstripes
    g.strokeStyle = '#ffd94a';
    g.lineWidth = 5;
    for (let k = -6; k < 14; k++) {
      g.beginPath();
      for (let i = 0; i <= 30; i++) {
        const y = (i / 30) * H;
        const x = W * (0.3 + k * 0.06) + Math.sin((i / 30) * Math.PI) * W * 0.06 - (i / 30) * W * 0.08;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    // dark mask through the eye, pale face
    g.fillStyle = '#c9d6e8';
    g.fillRect(0, 0, X(0.12), H);
    g.fillStyle = '#0b0f25';
    g.fillRect(X(0.1), 0, X(0.06), H);
    g.fillStyle = '#ffcf2a';
    g.fillRect(X(0.93), 0, W, H);
  },
  puffer({ g, vgrad, dots, scales }) {
    vgrad('#8a7a3e', '#c9b46a', '#fbf6e6');
    dots(70, 3, 7, 'rgba(50,40,20,0.75)', 0.0, 0.55);
    scales(0.05, 10);
  },
  parrot({ g, vgrad, scales, X, H, W }) {
    vgrad('#13a38f', '#2ac6a8', '#86e3c8');
    // pink-rimmed scales
    g.save();
    g.strokeStyle = 'rgba(255,120,170,0.7)';
    g.lineWidth = 2.4;
    const s = 16;
    for (let y = -s; y < H + s; y += s * 0.75) {
      const off = (Math.round(y / (s * 0.75)) % 2) * s * 0.5;
      for (let x = W * 0.16 + off; x < W; x += s) {
        g.beginPath();
        g.arc(x, y, s * 0.6, Math.PI * 0.6, Math.PI * 1.4);
        g.stroke();
      }
    }
    g.restore();
    // beak and face
    g.fillStyle = '#e8f6f0';
    g.fillRect(0, 0, X(0.05), H);
    g.fillStyle = 'rgba(255,150,60,0.6)';
    g.fillRect(X(0.05), 0, X(0.06), H);
  },
  grouper({ g, vgrad, dots, scales, X, H }) {
    vgrad('#6b2a1a', '#a2412a', '#d9806a');
    dots(120, 2.5, 5, 'rgba(120,200,255,0.9)', 0, 1);
    g.globalAlpha = 0.25;
    for (let i = 0; i < 5; i++) {
      g.fillStyle = '#2a0a05';
      g.fillRect(X(0.25 + i * 0.14), 0, X(0.05), H);
    }
    g.globalAlpha = 1;
    scales(0.08, 10);
  },
  barracuda({ g, vgrad, X, top, bot, Yc, Hh, line, scales, W }) {
    vgrad('#33424f', '#a7b6c2', '#eef3f6');
    g.fillStyle = 'rgba(25,35,45,0.55)';
    for (let i = 0; i < 18; i++) {
      const t = 0.2 + i * 0.042;
      g.beginPath();
      g.moveTo(X(t), top(t));
      g.lineTo(X(t + 0.025), Yc(t) - Hh(t) * 0.1);
      g.lineTo(X(t + 0.012), top(t));
      g.fill();
    }
    line((t) => Yc(t) + Hh(t) * 0.15, 2, 'rgba(255,255,255,0.4)', 0.1, 1);
    scales(0.05, 7);
  },
  lantern({ g, vgrad, photophores, scales }) {
    vgrad('#0c1424', '#1d2c45', '#5d6f8c');
    photophores(9, 0.8);
    photophores(6, 0.62);
    scales(0.12, 8);
  },
  hatchet({ g, vgrad, photophores, line, Yc, Hh, X, H }) {
    vgrad('#4d5d6b', '#c9d4dc', '#eef4f8');
    g.fillStyle = 'rgba(30,40,55,0.5)';
    g.fillRect(0, 0, X(1), H * 0.2);
    photophores(10, 0.9, '#9ff');
  },
  angler({ g, vgrad, dots, X, Yc, Hh, H }) {
    vgrad('#2a1d16', '#3b2a1f', '#5a4434');
    dots(160, 1.5, 4.5, 'rgba(15,10,8,0.6)', 0, 1, 0, 1);
    dots(40, 2, 3, 'rgba(130,100,80,0.4)', 0, 1, 0, 1);
    // the cavernous mouth line
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, Yc(0) + 4);
    g.quadraticCurveTo(X(0.12), Yc(0.12) + Hh(0.12) * 0.3, X(0.2), Yc(0.2) + Hh(0.2) * 0.1);
    g.stroke();
  },
  shark({ g, vgrad, X, Yc, Hh, top, bot, W, H }) {
    vgrad('#4b5966', '#6e7f8d', '#f2f4f5');
    // countershading edge
    g.fillStyle = '#eef1f3';
    g.beginPath();
    g.moveTo(0, bot(0) + 5);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      g.lineTo(X(t), Yc(t) + Hh(t) * (0.1 + 0.08 * Math.sin(t * 25)));
    }
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();
    // gill slits
    g.strokeStyle = 'rgba(30,35,40,0.6)';
    g.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) {
      const t = 0.17 + i * 0.022;
      g.beginPath();
      g.moveTo(X(t), Yc(t) - Hh(t) * 0.35);
      g.quadraticCurveTo(X(t) + 4, Yc(t), X(t), Yc(t) + Hh(t) * 0.25);
      g.stroke();
    }
  },
  butterfly({ g, vgrad, X, Yc, Hh, W, H }) {
    vgrad('#ffd21f', '#ffe14a', '#fff3b0');
    // white face, a black bar through the eye and a false eye near the tail
    g.fillStyle = '#f7f4ea';
    g.fillRect(0, 0, X(0.2), H);
    g.fillStyle = '#16161c';
    g.fillRect(X(0.12), 0, X(0.05), H);
    g.strokeStyle = 'rgba(120,80,0,0.45)';
    g.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      g.beginPath();
      g.moveTo(X(0.26 + k * 0.08), 0);
      g.lineTo(X(0.12 + k * 0.08), H);
      g.stroke();
    }
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(X(0.8), Yc(0.8) - Hh(0.8) * 0.35, 13, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.stroke();
  },
  lionfish({ vgrad, band }) {
    vgrad('#f3e3d6', '#f6e8dc', '#fff6ee');
    // zebra bars of rust and maroon
    for (let k = 0; k < 13; k++) {
      const t = 0.06 + k * 0.072;
      band(t, t + 0.032, k % 2 ? '#7a1c12' : '#b23a22', 0.015);
    }
  },
  moray({ g, vgrad, rng, W, H }) {
    vgrad('#4c4a18', '#6b6a22', '#8d8a3a');
    // dark blotches leave a pale reticulated net between them
    g.fillStyle = '#2a250c';
    for (let i = 0; i < 900; i++) {
      g.beginPath();
      g.ellipse(rng.range(0, W), rng.range(0, H), rng.range(4, 9), rng.range(3, 6), rng.range(0, 3), 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(220,210,120,0.35)';
    g.fillRect(0, H * 0.8, W, H * 0.2);
  },
  capelin({ vgrad, line, Yc, Hh, scales }) {
    vgrad('#3e5a4c', '#c4d6d0', '#f5f9f8');
    line((t) => Yc(t) - Hh(t) * 0.1, 4, 'rgba(220,240,235,0.85)', 0.15, 1);
    scales(0.06, 7);
  },
  icefish({ g, vgrad, band, line, Yc, Hh }) {
    vgrad('#b9c7cf', '#e2ebef', '#f6fafb');
    g.globalAlpha = 0.35;
    for (let k = 0; k < 4; k++) band(0.3 + k * 0.16, 0.36 + k * 0.16, '#3a4a55', 0.02);
    g.globalAlpha = 1;
    line((t) => Yc(t) - Hh(t) * 0.05, 2, 'rgba(255,255,255,0.6)', 0.2, 1);
  },
  cod({ vgrad, dots, line, Yc, Hh, scales }) {
    vgrad('#5c5634', '#9a9264', '#ece6cf');
    dots(170, 2, 6, 'rgba(70,60,30,0.6)', 0, 0.6);
    dots(60, 2, 4, 'rgba(220,210,170,0.35)', 0, 0.6);
    line((t) => Yc(t) - Hh(t) * (0.32 - 0.25 * t), 3, 'rgba(250,245,225,0.75)', 0.22, 1);
    scales(0.05, 8);
  },
  salmon({ g, vgrad, dots, X, H, W }) {
    vgrad('#3f5566', '#b8c6cf', '#f4f6f6');
    // a blush of pink along the flank
    const gr = g.createLinearGradient(0, H * 0.35, 0, H * 0.75);
    gr.addColorStop(0, 'rgba(255,140,140,0)');
    gr.addColorStop(0.5, 'rgba(255,140,150,0.35)');
    gr.addColorStop(1, 'rgba(255,140,140,0)');
    g.fillStyle = gr;
    g.fillRect(X(0.15), 0, W, H);
    dots(90, 2, 4.5, 'rgba(20,25,35,0.75)', 0, 0.42, 0.15, 1);
  },
  sleeper({ g, vgrad, dots, X, Yc, Hh }) {
    vgrad('#3a3631', '#4f4a43', '#6d675e');
    dots(220, 3, 9, 'rgba(25,22,20,0.35)', 0, 1, 0, 1);
    dots(120, 1.5, 3, 'rgba(160,150,135,0.25)', 0, 1, 0, 1);
    // the pale parasite that hangs from a sleeper shark's eye
    g.fillStyle = 'rgba(220,215,190,0.9)';
    g.beginPath();
    g.ellipse(X(0.085), Yc(0.085) - Hh(0.085) * 0.25, 5, 3, 0, 0, Math.PI * 2);
    g.fill();
  },
  viper({ vgrad, photophores, line, Yc, Hh }) {
    vgrad('#0d1a26', '#1c3446', '#36506a');
    line((t) => Yc(t) - Hh(t) * 0.1, 3, 'rgba(120,200,255,0.25)', 0.1, 1);
    photophores(14, 0.86);
    photophores(10, 0.68, '#7cf');
  },
  megalodon({ g, vgrad, X, Yc, Hh, bot, W, H, rng }) {
    vgrad('#3b4652', '#56626f', '#c5ccd2');
    g.fillStyle = '#c3cacf';
    g.beginPath();
    g.moveTo(0, bot(0) + 5);
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      g.lineTo(X(t), Yc(t) + Hh(t) * (0.2 + 0.06 * Math.sin(t * 19)));
    }
    g.lineTo(W, H);
    g.lineTo(0, H);
    g.fill();
    // old scars
    g.strokeStyle = 'rgba(200,205,210,0.4)';
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = rng.range(W * 0.25, W * 0.8), y = rng.range(H * 0.2, H * 0.5);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rng.range(20, 50), y + rng.range(-8, 8));
      g.stroke();
    }
    g.strokeStyle = 'rgba(20,24,28,0.6)';
    g.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) {
      const t = 0.17 + i * 0.022;
      g.beginPath();
      g.moveTo(X(t), Yc(t) - Hh(t) * 0.35);
      g.quadraticCurveTo(X(t) + 4, Yc(t), X(t), Yc(t) + Hh(t) * 0.25);
      g.stroke();
    }
  },
};

// Small silhouettes for the food-chain HUD.
export function drawIcon(sp, skin, w = 54, h = 34) {
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = w * dpr;
  cv.height = h * dpr;
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const M = maxHalf(sp);
  const bodyLen = w * 0.66;
  const x0 = w * 0.92, s = bodyLen;
  const yc = h / 2;
  const scaleY = Math.min((h * 0.42) / M, s);
  const px = (t) => x0 - t * s;
  const py = (t, k) => yc - (centerOff(sp, t) + k * sampleProfile(sp.profile, t)) * scaleY;
  // tail
  g.fillStyle = `rgb(${(sp.tailCol || sp.fin).map((v) => Math.round(v * 255))})`;
  const tsp = sp.tail.span * scaleY, tl = sp.tail.len * s;
  g.beginPath();
  g.moveTo(px(0.97), py(1, 0));
  g.lineTo(px(1) - tl, yc - tsp);
  g.lineTo(px(1) - tl * (sp.tail.type === 'fork' || sp.tail.type === 'lunate' ? 0.6 : 0.95), yc);
  g.lineTo(px(1) - tl, yc + tsp);
  g.closePath();
  g.fill();
  // dorsal
  g.fillStyle = `rgb(${sp.fin.map((v) => Math.round(v * 255))})`;
  const d = sp.dorsal;
  g.beginPath();
  g.moveTo(px(d.t0), py(d.t0, 1) + 1);
  g.lineTo(px(d.t0 + (d.t1 - d.t0) * 0.3), py(d.t0, 1) - d.h * scaleY * 1.2);
  g.lineTo(px(d.t1), py(d.t1, 1) + 1);
  g.fill();
  // body clipped with the skin
  g.save();
  g.beginPath();
  for (let i = 0; i <= 30; i++) g.lineTo(px(i / 30), py(i / 30, 1));
  for (let i = 30; i >= 0; i--) g.lineTo(px(i / 30), py(i / 30, -1));
  g.closePath();
  g.clip();
  g.translate(x0, yc - M * scaleY);
  g.scale(-s / skin.width, (2 * M * scaleY) / skin.height);
  g.drawImage(skin, 0, 0);
  g.restore();
  // eye
  const e = sp.eye;
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(px(e.t), yc - (e.y + centerOff(sp, e.t)) * scaleY, Math.max(1.6, e.r * s * 0.9), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111';
  g.beginPath();
  g.arc(px(e.t) - 0.4, yc - (e.y + centerOff(sp, e.t)) * scaleY, Math.max(1, e.r * s * 0.55), 0, Math.PI * 2);
  g.fill();
  return cv;
}
