import * as THREE from 'three';
import { newOut, tubeAlong, geoOf, mergeIndexed, tint, placed, faceted } from './geo.js';

// ---------------------------------------------------------------------------
// Sea-floor details: starfish, urchins, shells, pebbles, bubble coral, sea whips
// ---------------------------------------------------------------------------
export function starfishGeo() {
  const out = newOut();
  const rings = 6, segs = 80;
  const R = (a) => 0.28 + 0.72 * Math.pow(Math.abs(Math.cos((a * 5) / 2)), 2.2);
  out.pos.push(0, 0.16, 0);
  out.nor.push(0, 1, 0);
  out.uv.push(0.5, 0.5);
  out.col.push(1, 1, 1);
  for (let i = 1; i <= rings; i++) {
    const f = i / rings;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const r = f * R(a);
      // arms taper and curl up a little at the tips
      const y = (1 - f * f) * 0.16 * (0.5 + 0.5 * R(a)) + Math.pow(f, 4) * 0.05;
      out.pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      out.nor.push(0, 1, 0);
      out.uv.push(f, j / segs);
      // knobbly skin: pale bumps scattered over the arms
      const k = 0.85 + 0.25 * Math.max(0, Math.sin(j * 2.7 + i * 1.9));
      out.col.push(k, k, k);
    }
  }
  for (let j = 0; j < segs; j++) out.idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + ((j + 1) % segs);
      const c = a + segs, d = b + segs;
      out.idx.push(a, b, c, b, d, c);
    }
  const g = geoOf(out);
  g.computeVertexNormals();
  return g;
}

export function urchinGeo() {
  const parts = [tint(new THREE.SphereGeometry(0.3, 14, 10).scale(1, 0.7, 1), 0.7)];
  const n = 70;
  for (let i = 0; i < n; i++) {
    // spines spread over the upper hemisphere on a golden spiral
    const y = 1 - (i / (n - 1)) * 1.15;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996;
    const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize();
    const c = tint(new THREE.ConeGeometry(0.022, 0.55, 4), 1.15);
    c.translate(0, 0.27, 0);
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
    c.translate(d.x * 0.24, d.y * 0.17, d.z * 0.24);
    parts.push(c);
  }
  return mergeIndexed(parts);
}

export function shellGeo() {
  // a ribbed scallop lying on the sand
  const g = new THREE.SphereGeometry(0.5, 20, 6, 0, Math.PI, 0, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.08 * Math.abs(Math.sin(a * 9));
    p.setXYZ(i, x * k, p.getY(i) * 0.35, z * k);
  }
  g.computeVertexNormals();
  const ear = tint(new THREE.BoxGeometry(0.3, 0.06, 0.12).translate(0, 0.03, -0.02), 0.9);
  return mergeIndexed([tint(g, 1), ear]);
}

export function pebbleGeo(seed = 1) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.8 + 0.4 * Math.abs(Math.sin(i * 12.9898 * seed) * 43758.5453 % 1);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.55, p.getZ(i) * k);
  }
  return tint(faceted(g), 1);
}

export function bubbleCoralGeo(rng) {
  const parts = [];
  for (let i = 0; i < 16; i++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 0.55;
    const s = rng.range(0.12, 0.24);
    parts.push(tint(new THREE.SphereGeometry(s, 10, 8).translate(Math.cos(a) * r, s * 0.8 + rng.range(0, 0.25), Math.sin(a) * r), rng.range(0.9, 1.2)));
  }
  return mergeIndexed(parts);
}

export function seaWhipGeo(rng, tall = 2.2, n = 7) {
  const out = newOut(1.2);
  for (let i = 0; i < n; i++) {
    const pts = [];
    let p = new THREE.Vector3(rng.range(-0.2, 0.2), 0, rng.range(-0.2, 0.2));
    const d = new THREE.Vector3(rng.range(-0.4, 0.4), 1, rng.range(-0.4, 0.4)).normalize();
    const h = tall * rng.range(0.6, 1.1);
    for (let k = 0; k <= 7; k++) {
      pts.push(p.clone());
      d.x += rng.range(-0.15, 0.15);
      d.z += rng.range(-0.15, 0.15);
      d.normalize();
      p = p.clone().addScaledVector(d, h / 7);
    }
    tubeAlong(pts, 0.045, 0.018, 5, out);
  }
  return geoOf(out);
}

// a frilly soft coral: a short trunk under a cauliflower of small lobes
export function softCoralGeo(rng) {
  const parts = [tint(new THREE.CylinderGeometry(0.16, 0.24, 0.6, 8).translate(0, 0.3, 0), 0.8)];
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 0.45;
    const s = rng.range(0.1, 0.2);
    parts.push(tint(new THREE.SphereGeometry(s, 8, 6).translate(Math.cos(a) * r, 0.6 + rng.range(0, 0.5) * (1 - r), Math.sin(a) * r), 1.15));
  }
  return mergeIndexed(parts);
}

// ---------------------------------------------------------------------------
// The sunken ship
// ---------------------------------------------------------------------------
// a planked hull lofted along x: bow at +L/2, open at the top; uv.x along the
// length, uv.y around the section (0 port rail .. 0.5 keel .. 1 starboard rail)
export function hullGeo(L = 26, W = 3.6, D = 4.4, broken = false) {
  const out = newOut();
  const nL = 60, nA = 28;
  for (let i = 0; i <= nL; i++) {
    const u = i / nL;
    const x = (u - 0.5) * L;
    // a fuller stern, a pointed bow that rises
    const bow = Math.max(0, u - 0.6) / 0.4;
    const width = W * Math.sqrt(Math.max(0.02, 1 - Math.pow(bow, 2.2))) * (u < 0.06 ? 0.85 + u * 2.5 : 1);
    const depth = D * (1 - 0.35 * bow * bow);
    const sheer = 0.9 * bow * bow + (1 - u) * 0.4;
    for (let j = 0; j <= nA; j++) {
      const v = j / nA;
      const th = (v - 0.5) * Math.PI;
      const y = -Math.pow(Math.cos(th), 0.8) * depth + sheer;
      const z = Math.sin(th) * width * (1 + 0.08 * Math.cos(th));
      out.pos.push(x, y, z);
      out.nor.push(0, 0, 0);
      out.uv.push(u, v);
      out.col.push(1, 1, 1);
    }
  }
  for (let i = 0; i < nL; i++)
    for (let j = 0; j < nA; j++) {
      const a = i * (nA + 1) + j, b = a + 1, c = a + nA + 1, d = c + 1;
      out.idx.push(a, c, b, b, c, d);
    }
  const hull = geoOf(out);
  hull.computeVertexNormals();
  const parts = [hull];
  // ribs showing through the gaps, and the deck beams across the top
  const ribs = newOut();
  for (let i = 1; i < 18; i++) {
    const u = 0.05 + (i / 18) * 0.85;
    const x = (u - 0.5) * L;
    const bow = Math.max(0, u - 0.6) / 0.4;
    const width = W * Math.sqrt(Math.max(0.02, 1 - Math.pow(bow, 2.2))) * 0.94;
    const depth = D * (1 - 0.35 * bow * bow) * 0.94;
    const sheer = 0.9 * bow * bow + (1 - u) * 0.4;
    const pts = [];
    for (let j = 0; j <= 10; j++) {
      const th = (j / 10 - 0.5) * Math.PI;
      pts.push(new THREE.Vector3(x, -Math.pow(Math.cos(th), 0.8) * depth + sheer + 0.1, Math.sin(th) * width));
    }
    tubeAlong(pts, 0.13, 0.13, 5, ribs);
    if (i % 3 === 0 && !(broken && i > 12)) tubeAlong([new THREE.Vector3(x, sheer - 0.2, -width), new THREE.Vector3(x, sheer - 0.2, width)], 0.12, 0.12, 4, ribs);
  }
  // the keel
  const keel = [];
  for (let i = 0; i <= 20; i++) {
    const u = 0.02 + (i / 20) * 0.96;
    const bow = Math.max(0, u - 0.6) / 0.4;
    keel.push(new THREE.Vector3((u - 0.5) * L, -D * (1 - 0.35 * bow * bow) + 0.9 * bow * bow + (1 - u) * 0.4 - 0.1, 0));
  }
  tubeAlong(keel, 0.22, 0.22, 6, ribs);
  for (let k = 0; k < ribs.col.length; k++) ribs.col[k] = 0.7;
  parts.push(geoOf(ribs));
  return mergeIndexed(parts);
}

export function mastGeo(len = 16) {
  const parts = [tint(new THREE.CylinderGeometry(0.22, 0.32, len, 10, 8).translate(0, len / 2, 0), 0.85)];
  // a yard and a crow's nest
  parts.push(tint(new THREE.CylinderGeometry(0.14, 0.14, len * 0.55, 8).rotateZ(Math.PI / 2).translate(0, len * 0.7, 0), 0.8));
  parts.push(tint(new THREE.CylinderGeometry(0.9, 0.75, 0.5, 12, 1, true).translate(0, len * 0.82, 0), 0.75));
  // a broken stump of a second yard and snapped rigging
  parts.push(tint(new THREE.CylinderGeometry(0.12, 0.12, len * 0.3, 6).rotateZ(Math.PI / 2 - 0.4).translate(len * 0.08, len * 0.45, 0), 0.8));
  return mergeIndexed(parts);
}

export function barrelGeo() {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(0.42 + 0.1 * Math.sin(Math.PI * t), t * 1.2));
  }
  const body = tint(new THREE.LatheGeometry(pts, 16), 1);
  const bands = [0.12, 0.45, 0.75, 1.08].map((y) => tint(new THREE.TorusGeometry(0.47 + 0.07 * Math.sin(Math.PI * (y / 1.2)), 0.035, 5, 18).rotateX(Math.PI / 2).translate(0, y, 0), 0.45));
  const lids = [tint(new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2).translate(0, 1.2, 0), 0.85)];
  return mergeIndexed([body, ...bands, ...lids]);
}

export function cannonGeo() {
  const pts = [];
  const prof = [[0, 0], [0.02, 0.3], [0.1, 0.34], [0.14, 0.3], [0.9, 0.22], [0.93, 0.27], [1, 0.27], [1, 0.14], [0.95, 0.12]];
  for (const [t, r] of prof) pts.push(new THREE.Vector2(r, t * 2.6));
  const barrel = tint(new THREE.LatheGeometry(pts, 14), 1);
  barrel.rotateZ(-Math.PI / 2);
  const knob = tint(new THREE.SphereGeometry(0.14, 8, 6).translate(-0.08, 0, 0), 1);
  return mergeIndexed([barrel, knob]);
}

export function anchorGeo() {
  const out = newOut();
  const V = (x, y) => new THREE.Vector3(x, y, 0);
  tubeAlong([V(0, 0), V(0, 2.2), V(0, 4.2)], 0.16, 0.14, 8, out);
  const arm = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (0.05 + (i / 12) * 0.9);
    arm.push(V(Math.cos(a) * 1.5, 1.35 - Math.sin(a) * 1.35));
  }
  tubeAlong(arm, 0.15, 0.15, 8, out);
  tubeAlong([V(-1.2, 4.0), V(1.2, 4.0)].map((p) => p.set(p.x * 0, p.y, p.x)), 0.12, 0.12, 6, out);
  const g = geoOf(out);
  const ring = tint(new THREE.TorusGeometry(0.35, 0.08, 6, 14).translate(0, 4.6, 0), 1);
  const flukes = [-1, 1].map((s) => tint(new THREE.ConeGeometry(0.32, 0.7, 4).rotateZ(s * 0.9).translate(s * 1.48, 1.5, 0), 1));
  return mergeIndexed([g, ring, ...flukes]);
}

// treasure chest: a box base and a rounded lid (separate so the lid can open)
export function chestGeos() {
  const base = mergeIndexed([
    tint(new THREE.BoxGeometry(1.5, 0.75, 0.95).translate(0, 0.375, 0), 1),
    ...[-0.6, 0.6].map((x) => tint(new THREE.BoxGeometry(0.1, 0.78, 0.99).translate(x, 0.39, 0), 0.45)),
  ]);
  const lid = mergeIndexed([
    tint(new THREE.CylinderGeometry(0.48, 0.48, 1.5, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(0, 0, 0.48), 1),
    ...[-0.6, 0.6].map((x) => tint(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(x, 0, 0.48), 0.45)),
  ]);
  // the lid hinges at the back edge (z = 0 in its own frame)
  return { base, lid };
}

export function goldGeo(rng) {
  const parts = [];
  for (let i = 0; i < 26; i++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 0.55;
    parts.push(tint(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 10).rotateX(rng.range(-0.6, 0.6)).translate(Math.cos(a) * r, 0.7 + (0.55 - r) * 0.35, Math.sin(a) * r * 0.6), 1));
  }
  parts.push(tint(new THREE.SphereGeometry(0.17, 12, 8).translate(0.2, 0.92, 0.05), 1.2));
  return mergeIndexed(parts);
}

// ---------------------------------------------------------------------------
// Polar ice
// ---------------------------------------------------------------------------
export function icebergGeo(rng, w, h, d) {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const seed = rng.range(0, 100);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // a flat top against the ice sheet, a keel narrowing to a point below
    const k = 1 + 0.22 * Math.sin(x * 3.1 + seed) * Math.sin(z * 2.7 + seed * 0.7) + 0.12 * Math.sin(y * 7 + x * 5 + seed);
    const taper = y < 0 ? 0.35 + 0.65 * Math.pow(1 + y, 0.8) : 1;
    p.setXYZ(i, x * w * k * taper, Math.min(y, 0.55) * h, z * d * k * taper);
  }
  return tint(faceted(g), 1);
}

export function icicleGeo(rng) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const h = rng.range(0.4, 1.6) * (i === 0 ? 1.6 : 1), r = rng.range(0.06, 0.16);
    parts.push(tint(new THREE.ConeGeometry(r, h, 6).rotateX(Math.PI).translate(rng.range(-0.6, 0.6), -h / 2, rng.range(-0.6, 0.6)), 1));
  }
  return faceted(mergeIndexed(parts));
}

// ---------------------------------------------------------------------------
// Volcanic trench
// ---------------------------------------------------------------------------
export function basaltGeo(rng) {
  // a cluster of hexagonal columns of uneven height
  const parts = [];
  for (let i = 0; i < 12; i++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 1.4;
    const h = rng.range(1.5, 6) * (1.2 - r * 0.4);
    const c = new THREE.CylinderGeometry(0.42, 0.45, h, 6, 1);
    c.rotateY(rng.range(0, 1)).translate(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    // the cut top catches the light a little more
    parts.push(tint(c, rng.range(0.8, 1.1)));
  }
  return faceted(mergeIndexed(parts));
}

export function smokerGeo(rng, h) {
  const g = new THREE.CylinderGeometry(0.45, 1.4, h, 10, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = rng.range(0.82, 1.18);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) + h / 2, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return tint(g, 1);
}

export { placed };
