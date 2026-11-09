import * as THREE from 'three';
import { G, COMMON } from '../core/globals.js';
import { SPECIES, sampleProfile, sampleCenter, maxHalf, paintSkin, drawIcon } from './species.js';

// ---------------------------------------------------------------------------
// Geometry. Fish are modelled one body-length long, nose at x = +0.5, tail root
// at x = -0.5, flanks facing ±z. Every vertex carries:
//   aS   0 at the nose -> 1 at the tail root (> 1 out on the tail fin): drives the swim wave
//   aFin 0 body, 1 median fins, 2/3 left/right pectoral, 4 pelvic
//   aW   jaw weight on the body (signed), tip weight on fins
// ---------------------------------------------------------------------------

class Buf {
  constructor() {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.s = [];
    this.f = [];
    this.w = [];
    this.i = [];
  }
  v(x, y, z, u, vv, fin, w, nx = 0, ny = 0, nz = 1) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    this.uv.push(u, vv);
    this.s.push(0.5 - x);
    this.f.push(fin);
    this.w.push(w);
    return this.p.length / 3 - 1;
  }
  geo(computeNormals = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(this.s, 1));
    g.setAttribute('aFin', new THREE.Float32BufferAttribute(this.f, 1));
    g.setAttribute('aW', new THREE.Float32BufferAttribute(this.w, 1));
    g.setIndex(this.i);
    if (computeNormals) g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

function bodyGeometry(sp) {
  const B = new Buf();
  const nT = 46, nA = 26;
  const M = maxHalf(sp);
  const ts = [];
  for (let i = 0; i < nT; i++) ts.push(0.5 - 0.5 * Math.cos((Math.PI * i) / (nT - 1)));
  const ring0 = [];
  for (let i = 0; i < nT; i++) {
    const t = ts[i];
    const h = sampleProfile(sp.profile, t);
    const cy = sp.center ? sampleCenter(sp.center, t) : 0;
    // rounder near the nose, flatter flanks behind
    const w = h * sp.wr * (1 + 0.25 * Math.max(0, 0.2 - t) * 5);
    const x = 0.5 - t;
    const jawZone = Math.max(0, 1 - t / 0.17);
    const row = [];
    for (let a = 0; a < nA; a++) {
      const ang = (a / nA) * Math.PI * 2;
      const sy = Math.sin(ang), cz = Math.cos(ang);
      // a keel-ish back and a fuller belly
      const zz = w * cz * (1 - 0.22 * Math.max(sy, 0));
      const yy = cy + h * sy;
      const jaw = jawZone * (sy < -0.05 ? -1 : sy > 0.15 ? 0.35 : 0) * Math.min(1, Math.abs(sy) * 2);
      row.push(B.v(x, yy, zz, t, 0.5 + yy / (2 * M), 0, jaw));
    }
    ring0.push(row);
  }
  for (let i = 0; i < nT - 1; i++)
    for (let a = 0; a < nA; a++) {
      const a2 = (a + 1) % nA;
      const p = ring0[i][a], q = ring0[i][a2], r = ring0[i + 1][a], s = ring0[i + 1][a2];
      B.i.push(p, q, r, q, s, r);
    }
  // caps
  const cy0 = sp.center ? sampleCenter(sp.center, 0) : 0;
  const nose = B.v(0.505, cy0, 0, 0, 0.5 + cy0 / (2 * M), 0, 0);
  const cy1 = sp.center ? sampleCenter(sp.center, 1) : 0;
  const tail = B.v(-0.5, cy1, 0, 1, 0.5 + cy1 / (2 * M), 0, 0);
  for (let a = 0; a < nA; a++) {
    const a2 = (a + 1) % nA;
    B.i.push(nose, ring0[0][a2], ring0[0][a]);
    B.i.push(tail, ring0[nT - 1][a], ring0[nT - 1][a2]);
  }
  return B.geo(true);
}

// height profile of a median fin along its base (u 0 front -> 1 back)
function finShape(shape, u) {
  const s = Math.sin(Math.PI * u);
  switch (shape) {
    case 'tri': return Math.min(u / 0.28, 1) * Math.pow(1 - u, 0.7) * 1.25;
    case 'round': return Math.pow(s, 0.6);
    case 'low': return (0.55 + 0.45 * s) * Math.min(1, u * 8) * Math.min(1, (1 - u) * 6);
    case 'sail': return (0.25 + 0.75 * Math.pow(u, 1.3)) * Math.min(1, (1 - u) * 5) * Math.min(1, u * 10);
    case 'spiny': return (0.6 + 0.4 * Math.abs(Math.sin(u * Math.PI * 9))) * Math.min(1, u * 6) * Math.min(1, (1 - u) * 4);
    case 'double': return (0.55 + 0.45 * Math.abs(Math.sin(u * Math.PI * 1.8))) * Math.min(1, u * 6) * Math.min(1, (1 - u) * 5);
    case 'flow': return Math.pow(s, 0.45) * (0.7 + 0.6 * u);
    case 'shark': return u < 0.4 ? u / 0.4 : Math.pow(1 - (u - 0.4) / 0.6, 0.6);
    // venomous spines with a little webbing between them
    case 'quills': return (0.12 + 0.88 * Math.pow(Math.abs(Math.sin(u * Math.PI * 6.5)), 4)) * Math.min(1, u * 5) * (1 - u * 0.5);
    default: return s;
  }
}

function medianFin(B, sp, spec, dir) {
  const n = spec.shape === 'quills' ? 64 : 18;
  const sweep = spec.shape === 'sail' ? 1.3 : spec.shape === 'shark' ? 0.9 : spec.shape === 'flow' ? 0.9 : 0.45;
  const base = [], outer = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const t = spec.t0 + (spec.t1 - spec.t0) * u;
    const h = sampleProfile(sp.profile, t);
    const cy = sp.center ? sampleCenter(sp.center, t) : 0;
    const by = cy + dir * h * 0.88;
    const fh = spec.h * finShape(spec.shape, u);
    const x = 0.5 - t;
    // membranes face the flanks; a little upward tilt keeps them lit from above
    base.push(B.v(x, by, 0, u, 0, 1, 0, 0, 0.3, 1));
    outer.push(B.v(x - fh * sweep, by + dir * fh, 0, u, 1, 1, 1, 0, 0.3, 1));
  }
  for (let i = 0; i < n; i++) B.i.push(base[i], base[i + 1], outer[i], base[i + 1], outer[i + 1], outer[i]);
}

function tailFin(B, sp) {
  const T = sp.tail;
  const n = 22;
  const hRoot = sampleProfile(sp.profile, 1) * 0.95;
  const cy = sp.center ? sampleCenter(sp.center, 1) : 0;
  const base = [], outer = [];
  for (let i = 0; i <= n; i++) {
    const v = (i / n) * 2 - 1; // -1 bottom .. 1 top
    let f, yo = cy + T.span * v;
    const av = Math.abs(v);
    switch (T.type) {
      case 'fork': f = 0.45 + 0.55 * Math.pow(av, 0.75); break;
      case 'lunate': f = 0.35 + 0.65 * Math.pow(av, 1.6); break;
      case 'round': f = 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - v * v)); break;
      case 'flow': f = 0.7 + 0.3 * Math.cos(v * Math.PI * 1.5) * 0.6 + 0.2 * av; break;
      case 'shark':
        f = v > 0 ? 0.25 + 1.0 * Math.pow(v, 0.9) : 0.25 + 0.5 * Math.pow(-v, 1.1);
        yo = cy + (v > 0 ? T.span * 1.25 * v : T.span * 0.7 * v);
        break;
      default: f = 0.7;
    }
    const x0 = -0.5 + 0.02;
    base.push(B.v(x0, cy + hRoot * v, 0, (v + 1) / 2, 0, 5, 0));
    const x1 = -0.5 - T.len * f - (T.type === 'shark' && v > 0 ? T.len * 0.3 * v : 0);
    outer.push(B.v(x1, yo, 0, (v + 1) / 2, 1, 5, 1));
  }
  for (let i = 0; i < n; i++) B.i.push(base[i], outer[i], base[i + 1], base[i + 1], outer[i], outer[i + 1]);
}

function pairedFin(B, sp, spec, kind) {
  // a small paddle on each flank, angled back and out
  const t = spec.t;
  const h = sampleProfile(sp.profile, t);
  const cy = sp.center ? sampleCenter(sp.center, t) : 0;
  const w = h * sp.wr;
  const len = spec.len * (spec.big ? 1.6 : 1);
  for (const side of [-1, 1]) {
    const fin = kind === 'pelvic' ? 4 : side < 0 ? 2 : 3;
    const by = kind === 'pelvic' ? cy - h * 0.85 : cy - h * 0.3;
    const bz = kind === 'pelvic' ? side * w * 0.3 : side * w * 0.92;
    const n = 8;
    const root = [], tip = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = 0.5 - t - u * len * 0.18;
      const ry = by + (u - 0.5) * len * 0.35;
      root.push(B.v(x, ry, bz, u, 0, fin, 0, 0, 0, side));
      const reach = len * (0.55 + 0.45 * Math.sin(Math.PI * u)) * (spec.big ? 1 : 1);
      const dx = -0.8, dy = kind === 'pelvic' ? -0.55 : -0.35, dz = side * (kind === 'pelvic' ? 0.25 : 0.45);
      const l = Math.hypot(dx, dy, dz);
      tip.push(B.v(x + (dx / l) * reach, ry + (dy / l) * reach, bz + (dz / l) * reach, u, 1, fin, 1, 0, 0, side));
    }
    for (let i = 0; i < n; i++) B.i.push(root[i], root[i + 1], tip[i], root[i + 1], tip[i + 1], tip[i]);
  }
}

function finGeometry(sp) {
  const B = new Buf();
  medianFin(B, sp, sp.dorsal, 1);
  if (sp.dorsal.second) medianFin(B, sp, { ...sp.dorsal.second, shape: 'tri' }, 1);
  medianFin(B, sp, sp.anal, -1);
  tailFin(B, sp);
  pairedFin(B, sp, sp.pectoral, 'pectoral');
  if (sp.pelvic) pairedFin(B, sp, sp.pelvic, 'pelvic');
  return B.geo(false);
}

// teeth, the angler's lure, the puffer's spines
function extrasGeometry(sp) {
  const parts = { teeth: null, spines: null, lure: null, bulb: null };
  const geos = [];
  const add = (g, m) => {
    g.applyMatrix4(m);
    geos.push(g);
  };
  if (sp.teeth) {
    const n = sp.fangs ? 5 : sp.lure ? 10 : 12;
    const len = sp.fangs ? 0.1 : sp.lure ? 0.075 : 0.025;
    for (const jaw of [1, -1])
      for (let i = 0; i < n; i++) {
        const t = 0.02 + (i / n) * (sp.lure || sp.fangs ? 0.17 : 0.1);
        const h = sampleProfile(sp.profile, t);
        const cy = sp.center ? sampleCenter(sp.center, t) : 0;
        for (const side of [-1, 1]) {
          const c = new THREE.ConeGeometry(len * 0.28, len * (0.7 + 0.6 * ((i * 7) % 3) / 2), 5);
          const m = new THREE.Matrix4().makeRotationZ(jaw > 0 ? Math.PI : 0);
          // upper teeth hang from the snout; the angler's lower fangs ride its open jaw
          const drop = jaw < 0 && (sp.lure || sp.fangs) ? -0.03 : 0;
          m.setPosition(0.5 - t + 0.01, cy + jaw * h * 0.1 - jaw * len * 0.2 + drop, side * h * sp.wr * (0.55 + 0.35 * (i / n)));
          add(c, m);
        }
      }
    parts.teeth = mergeSimple(geos.splice(0));
  }
  if (sp.puffer) {
    for (let i = 0; i < 90; i++) {
      const t = 0.12 + ((i * 0.618) % 1) * 0.7;
      const ang = i * 2.39996;
      const h = sampleProfile(sp.profile, t) * 2.0;
      const w = h * sp.wr;
      const n = new THREE.Vector3(0, Math.sin(ang), Math.cos(ang));
      const c = new THREE.ConeGeometry(0.018, 0.09, 4);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(0.5 - t, n.y * h, n.z * w), q, new THREE.Vector3(1, 1, 1));
      add(c, m);
    }
    parts.spines = mergeSimple(geos.splice(0));
  }
  if (sp.lure) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.36, 0.3, 0), new THREE.Vector3(0.5, 0.48, 0), new THREE.Vector3(0.68, 0.48, 0), new THREE.Vector3(0.78, 0.32, 0),
    ]);
    parts.lure = new THREE.TubeGeometry(curve, 20, 0.008, 5);
    parts.bulb = new THREE.SphereGeometry(0.045, 14, 10).translate(0.79, 0.28, 0);
  }
  return parts;
}
function mergeSimple(list) {
  // merge non-indexed + indexed geometries keeping only position/normal
  let count = 0;
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------
const FISH_VERT = /* glsl */ `
attribute float aS;
attribute float aFin;
attribute float aW;
uniform float uPhase, uAmp, uK, uBend, uChomp, uInflate, uFlap, uStiff;
varying vec3 vWP;
varying vec3 vN;
varying vec2 vUv;
varying float vFin;
varying float vW;
varying float vSize;
void main(){
  vec3 p = position;
  vSize = length(modelMatrix[0].xyz);
  vec3 n = normal;
  float s = aS;
  if (uInflate > 0.0 && aFin < 0.5) {
    float b = pow(sin(clamp(s, 0.0, 1.0) * 3.14159), 0.6);
    p.yz *= 1.0 + uInflate * b;
  }
  // jaws drop open when biting
  if (aFin < 0.5) {
    p.y += aW * uChomp * 0.075;
    p.x -= abs(aW) * uChomp * 0.035;
  }
  // the swimming wave: stiff head, travelling S-curve, flicking tail
  float w = pow(max(s - uStiff, 0.0), 1.45);
  float ph = s * uK - uPhase;
  float lat = uAmp * w * sin(ph) + uBend * s * s;
  p.z += lat;
  // the wave turns the surface: tilt normals with the slope of the curve
  float slope = uAmp * (1.45 * pow(max(s - uStiff, 0.0), 0.45) * sin(ph) + w * cos(ph) * uK) + 2.0 * uBend * s;
  n.x += slope * n.z * 0.6;
  n = normalize(n);
  // fins ripple; pectorals row
  if ((aFin > 0.5 && aFin < 1.5) || aFin > 4.5) p.z += sin(uPhase * 1.6 + s * 9.0) * 0.018 * aW;
  if (aFin > 1.5 && aFin < 3.5) {
    float side = aFin > 2.5 ? 1.0 : -1.0;
    p.z += side * (0.5 + 0.5 * sin(uPhase * 0.9 + 1.3)) * 0.06 * aW * uFlap;
    p.x += sin(uPhase * 0.9) * 0.02 * aW * uFlap;
  }
  if (aFin > 3.5 && aFin < 4.5) p.z += sin(uPhase * 0.7) * 0.02 * aW;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  vUv = uv;
  vFin = aFin;
  vW = aW;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FISH_FRAG = /* glsl */ `
uniform sampler2D tSkin;
uniform sampler2D tGlow;
uniform sampler2D tFin;
uniform vec3 uFinCol, uFinEdge, uTailCol, uTailEdge, uGlowCol, uRimCol;
uniform float uFinAlpha, uShine, uIrid, uFlash, uDanger, uGlow, uFade, uIsFin;
uniform float uScaleN, uAsp, uScaleK, uMetal, uBumpK;
varying float vSize;
varying vec3 vWP;
varying vec3 vN;
varying vec2 vUv;
varying float vFin;
varying float vW;
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }

// overlapping scales laid in offset rows; the one nearest the head lies on top.
// returns (height 0..1, per-scale random, rim 0..1)
vec3 scales(vec2 p){
  float bestX = 1e9, r = 1.0, h = 0.0;
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++){
      vec2 cell = floor(p) + vec2(float(i), float(j));
      vec2 c = cell + vec2(0.5 + mod(cell.y, 2.0) * 0.5, 0.5);
      float d = length((p - c) * vec2(1.0, 0.9)) / 0.74;
      if (d < 1.0 && c.x < bestX){ bestX = c.x; r = d; h = hash12(cell + 17.0); }
    }
  return vec3(1.0 - r * r, h, smoothstep(0.72, 1.0, r));
}
vec3 bump(vec3 pos, vec3 n, float hgt, float k){
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(hgt) * r1 + dFdy(hgt) * r2) * k;
  return normalize(abs(det) * n - grad);
}

void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 albedo;
  float alpha = 1.0;
  vec3 emit = vec3(0.0);
  bool inside = false;
  float glint = 1.0, rim = 0.0, sk = 0.0;
  // scale relief, evaluated outside any branch so the screen-space derivatives stay valid
  vec2 sp = vec2(vUv.x * uScaleN, vUv.y * uScaleN * uAsp);
  float lod = max(length(fwidth(sp)), 1e-4);
  vec3 sc = scales(sp);
  sk = uScaleK * (1.0 - uIsFin) * (1.0 - smoothstep(0.2, 0.5, lod)) * smoothstep(0.08, 0.22, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
  vec3 bumpN = bump(vWP, N, sc.x * sk, uBumpK * vSize / uScaleN);
  if (uIsFin < 0.5) {
    albedo = toLin(texture2D(tSkin, vUv).rgb);
    emit = texture2D(tGlow, vUv).r * uGlowCol * uGlow;
    if (!gl_FrontFacing) { albedo = vec3(0.12, 0.01, 0.015); N = -N; inside = true; sk = 0.0; }
    else if (sk > 0.01) {
      N = bumpN;
      rim = sc.z * sk;
      glint = mix(1.0, 0.75 + 0.5 * sc.y, sk);
      albedo *= 1.0 - rim * 0.16;
      albedo *= 1.0 + (sc.y - 0.5) * 0.08 * sk;
    }
  } else {
    vec4 f = texture2D(tFin, vUv);
    bool tail = vFin > 4.5;
    vec3 base = tail ? mix(uTailCol, uTailEdge, smoothstep(0.45, 1.0, vUv.y)) : mix(uFinCol, uFinEdge, smoothstep(0.45, 1.0, vUv.y));
    albedo = toLin(base) * (0.82 + 0.35 * f.r);
    alpha = f.a * uFinAlpha;
    // thin membranes: light whichever side faces us
    if (dot(N, V) < 0.0) N = -N;
  }
  vec3 L = normalize(uLightDir);
  float ndl = dot(N, L);
  float ndv = max(dot(N, V), 0.0);
  float wrap = max((ndl + 0.45) / 1.45, 0.0);
  // sky light from above, the dim deep from below; a soft occlusion under the belly
  vec3 amb = mix(uDeep * 2.4 + 0.02, uShallow * 1.25, N.y * 0.5 + 0.5);
  amb *= 0.8 + 0.2 * smoothstep(-0.8, 0.3, N.y);
  float caus = causticLight(vWP, N);
  vec3 lit = amb + uSunCol * (wrap * 0.75 + caus * 1.6) + lavaLight(vWP, N);
  vec3 col = albedo * lit;
  // silvery fish mirror the water around them
  if (uMetal > 0.0 && !inside) {
    vec3 R = reflect(-V, N);
    vec3 env = waterCol(vWP.y + R.y * 8.0, R) * 2.2 + uSunCol * pow(max(R.y, 0.0), 6.0) * 0.9 * (1.0 - uBio);
    col = mix(col, env * (0.35 + albedo * 1.4) * glint, uMetal * (0.35 + 0.45 * pow(1.0 - ndv, 2.0)));
  }
  // fins and thin body edges glow when the light shines through them
  if (uIsFin > 0.5) col += albedo * uSunCol * pow(max(dot(-V, L), 0.0), 2.0) * 0.6;
  else if (!inside) col += albedo * uSunCol * pow(1.0 - ndv, 3.0) * max(dot(-V, L) + 0.3, 0.0) * 0.35;
  // wet scales: a tight highlight, a broad sheen and a thin-film shimmer at grazing angles
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  float spec = (pow(nh, 56.0) * 0.7 + pow(nh, 10.0) * 0.06) * uShine * glint;
  float fres = pow(1.0 - ndv, 3.0);
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 1.4 + vUv.x * 0.6 + rim * 0.3 + vec3(0.0, 0.33, 0.67)));
  if (!inside) {
    col += uSunCol * spec * (1.0 - depth01(vWP.y) * 0.6);
    float rimK = uIsFin > 0.5 ? 0.25 : 1.0;
    col += irid * (fres * 0.22 + sk * 0.05 * glint) * uIrid * (amb + 0.15) * rimK;
    col += uRimCol * fres * 0.55 * rimK;
  }
  col += emit;
  col += vec3(1.0, 0.18, 0.12) * (fres * 1.6 + 0.12) * uDanger;
  col = mix(col, vec3(1.6), uFlash);
  col = applyWaterFog(col, vWP);
  gl_FragColor = vec4(col, alpha * uFade);
  #ifdef DBGFIN
  if (uIsFin > 0.5) gl_FragColor = vec4(vUv, 0.0, 1.0);
  #endif
}`;

const EYE_VERT = /* glsl */ `
varying vec3 vWP; varying vec3 vON; varying vec3 vN;
void main(){
  vON = normal;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const EYE_FRAG = /* glsl */ `
uniform vec3 uIris;
uniform float uFlash;
varying vec3 vWP; varying vec3 vON; varying vec3 vN;
void main(){
  float d = dot(normalize(vON), vec3(0.0, 0.0, 1.0));
  vec3 c = vec3(0.92, 0.93, 0.9);
  c = mix(c, pow(uIris, vec3(2.2)) * 1.4, smoothstep(0.42, 0.47, d));
  c *= mix(1.0, 0.55, smoothstep(0.47, 0.75, d));
  c = mix(c, vec3(0.005), smoothstep(0.7, 0.74, d));
  vec3 N = normalize(vN), V = normalize(cameraPosition - vWP);
  vec3 L = normalize(uLightDir + vec3(0.0, 0.3, 0.5));
  float sp = pow(max(dot(reflect(-L, N), V), 0.0), 60.0);
  vec3 amb = mix(uDeep * 2.0 + 0.03, uShallow * 1.3, N.y * 0.5 + 0.5);
  vec3 col = c * (amb + uSunCol * max(dot(N, uLightDir), 0.0) * 0.6) + vec3(1.0) * sp * 1.4;
  col = mix(col, vec3(1.6), uFlash);
  gl_FragColor = vec4(applyWaterFog(col, vWP), 1.0);
}`;

const PROP_FRAG = /* glsl */ `
uniform vec3 uCol; uniform vec3 uEmit; uniform float uFlash;
varying vec3 vWP; varying vec3 vON; varying vec3 vN;
void main(){
  vec3 N = normalize(vN), V = normalize(cameraPosition - vWP);
  vec3 amb = mix(uDeep * 2.0 + 0.03, uShallow * 1.2, N.y * 0.5 + 0.5);
  vec3 col = uCol * (amb + uSunCol * max(dot(N, uLightDir), 0.0) * 0.6) + uEmit;
  col += pow(1.0 - max(dot(N, V), 0.0), 3.0) * uEmit * 0.8;
  col = mix(col, vec3(1.6), uFlash);
  gl_FragColor = vec4(applyWaterFog(col, vWP), 1.0);
}`;

// ---------------------------------------------------------------------------
// Per-species assets, built once and shared by every fish of that kind.
// ---------------------------------------------------------------------------
let finTex = null;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function finTexture() {
  if (finTex) return finTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const v = 1 - y / 255; // canvas top = fin tip (v = 1)
      const ray = Math.pow(Math.abs(Math.sin((x / 256) * Math.PI * 22)), 8);
      // a ragged, slightly thinner rim between the rays
      const rag = 0.88 + 0.12 * Math.sin(x * 0.29) * Math.sin(x * 0.071);
      const edge = 1 - smooth(0.8 * rag, rag, v) * (1 - ray * 0.6);
      const i = (y * 256 + x) * 4;
      img.data[i] = Math.round(ray * 255);
      img.data[i + 1] = img.data[i + 2] = 0;
      img.data[i + 3] = Math.round(Math.max(0, Math.min(1, (0.8 + 0.2 * ray) * edge)) * 255);
    }
  g.putImageData(img, 0, 0);
  finTex = new THREE.CanvasTexture(c);
  finTex.wrapS = THREE.RepeatWrapping;
  return finTex;
}

const KIT = {};
export function speciesKit(id) {
  if (KIT[id]) return KIT[id];
  const sp = SPECIES[id];
  const { skin, glow } = paintSkin(sp, id.length * 31 + 7);
  const tSkin = new THREE.CanvasTexture(skin);
  tSkin.anisotropy = 4;
  const tGlow = new THREE.CanvasTexture(glow);
  KIT[id] = {
    sp,
    body: bodyGeometry(sp),
    fins: finGeometry(sp),
    extras: extrasGeometry(sp),
    eye: new THREE.SphereGeometry(1, 20, 14),
    tSkin,
    tGlow,
    icon: drawIcon(sp, skin),
    eyeMat: null,
  };
  return KIT[id];
}

const v3 = (a) => new THREE.Vector3(...a);
function propMaterial(col, emit = [0, 0, 0]) {
  return new THREE.ShaderMaterial({
    uniforms: { ...G, uCol: { value: v3(col) }, uEmit: { value: v3(emit) }, uFlash: { value: 0 } },
    vertexShader: EYE_VERT,
    fragmentShader: COMMON + PROP_FRAG,
  });
}

// One fish's meshes and animation state.
export class FishModel {
  constructor(id) {
    const kit = speciesKit(id);
    const sp = kit.sp;
    this.sp = sp;
    this.group = new THREE.Group();
    this.pivot = new THREE.Group(); // scaled by size
    this.group.add(this.pivot);
    const U = {
      ...G,
      tSkin: { value: kit.tSkin },
      tGlow: { value: kit.tGlow },
      tFin: { value: finTexture() },
      uPhase: { value: Math.random() * 10 },
      uAmp: { value: 0.06 },
      uK: { value: sp.wave?.k ?? 6.5 },
      uStiff: { value: sp.wave?.stiff ?? 0.16 },
      uBend: { value: 0 },
      uChomp: { value: 0 },
      uInflate: { value: 0 },
      uFlap: { value: 1 },
      uFinCol: { value: v3(sp.fin) },
      uFinEdge: { value: v3(sp.finEdge) },
      uTailCol: { value: v3(sp.tailCol || sp.fin) },
      uTailEdge: { value: v3(sp.tailCol || sp.finEdge) },
      uGlowCol: { value: v3(sp.glow || [0, 0, 0]) },
      uRimCol: { value: new THREE.Vector3(0.12, 0.3, 0.38) },
      uFinAlpha: { value: sp.finAlpha },
      uShine: { value: sp.shine },
      uIrid: { value: sp.irid },
      uFlash: { value: 0 },
      uDanger: { value: 0 },
      uGlow: { value: sp.glow ? 1 : 0 },
      uFade: { value: 1 },
      uIsFin: { value: 0 },
      uScaleN: { value: sp.scaleN ?? 30 },
      uAsp: { value: 2 * maxHalf(sp) },
      uScaleK: { value: sp.scaleK ?? 1 },
      uMetal: { value: sp.metal ?? 0 },
      uBumpK: { value: 0.07 },
    };
    this.U = U;
    const bodyMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: FISH_VERT, fragmentShader: COMMON + FISH_FRAG, side: THREE.DoubleSide });
    // fins share every animated uniform object with the body
    const finU = { ...U, uIsFin: { value: 1 } };
    const finMat = new THREE.ShaderMaterial({
      defines: location.search.includes('dbgfin') ? { DBGFIN: 1 } : {},
      uniforms: finU, vertexShader: FISH_VERT, fragmentShader: COMMON + FISH_FRAG,
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
    });
    this.body = new THREE.Mesh(kit.body, bodyMat);
    this.fins = new THREE.Mesh(kit.fins, finMat);
    this.fins.renderOrder = 2;
    this.pivot.add(this.body, this.fins);
    // eyes
    if (!kit.eyeMat) {
      kit.eyeMat = new THREE.ShaderMaterial({ uniforms: { ...G, uIris: { value: v3(sp.eye.iris) }, uFlash: { value: 0 } }, vertexShader: EYE_VERT, fragmentShader: COMMON + EYE_FRAG });
    }
    const e = sp.eye;
    const ht = sampleProfile(sp.profile, e.t);
    const cy = sp.center ? sampleCenter(sp.center, e.t) : 0;
    const ez = ht * sp.wr * 0.78;
    this.eyes = [];
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(kit.eye, kit.eyeMat);
      m.scale.setScalar(e.r);
      m.position.set(0.5 - e.t, cy + e.y, side * ez);
      if (side < 0) m.rotation.y = Math.PI;
      m.rotation.x = -0.1;
      this.pivot.add(m);
      this.eyes.push(m);
    }
    // extras
    const X = kit.extras;
    if (X.teeth) this.pivot.add(new THREE.Mesh(X.teeth, propMaterial([0.95, 0.93, 0.85], [0.02, 0.02, 0.02])));
    if (X.spines) {
      this.spines = new THREE.Mesh(X.spines, propMaterial([0.9, 0.85, 0.6]));
      this.spines.visible = false;
      this.pivot.add(this.spines);
    }
    if (X.lure) {
      this.pivot.add(new THREE.Mesh(X.lure, propMaterial([0.25, 0.18, 0.12])));
      this.bulb = new THREE.Mesh(X.bulb, propMaterial([0.6, 1, 0.9], [1.5, 4.5, 3.6]));
      this.pivot.add(this.bulb);
    }
    this.size = 1;
    this.facing = 1;
    this.yaw = -0.12;
  }
  setSize(s) {
    this.size = s;
    this.pivot.scale.setScalar(s);
  }
  setInflate(k) {
    this.U.uInflate.value = k;
    if (this.spines) {
      this.spines.visible = k > 0.05;
      this.spines.scale.setScalar(0.5 + 0.5 * Math.min(1, k));
    }
  }
  setFlash(k) {
    this.U.uFlash.value = k;
  }
  dispose() {
    this.body.material.dispose();
    this.fins.material.dispose();
  }
}

export function iconFor(id) {
  return speciesKit(id).icon;
}
