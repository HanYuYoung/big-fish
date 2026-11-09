import * as THREE from 'three';

// Small helpers for building scenery meshes by hand. Every builder fills an `out`
// record of flat arrays; geoOf turns it into a BufferGeometry with a colour
// attribute, so scenery can be tinted per vertex and per instance.

export const newOut = (tipK = 0) => ({ pos: [], nor: [], uv: [], col: [], idx: [], tipK });

// a tube swept along a polyline, radius easing from r0 to r1
export function tubeAlong(pts, r0, r1, sides, out) {
  const base = out.pos.length / 3;
  const n0 = new THREE.Vector3(1, 0, 0), t = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  if (Math.abs(pts[1].clone().sub(pts[0]).normalize().x) > 0.9) n0.set(0, 1, 0);
  for (let i = 0; i < pts.length; i++) {
    t.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    n0.addScaledVector(t, -n0.dot(t)).normalize();
    b.crossVectors(t, n0);
    const r = r0 + (r1 - r0) * (i / (pts.length - 1));
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      d.copy(n0).multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a));
      out.pos.push(pts[i].x + d.x * r, pts[i].y + d.y * r, pts[i].z + d.z * r);
      out.nor.push(d.x, d.y, d.z);
      out.uv.push(s / sides, i / (pts.length - 1));
      const tip = Math.pow(i / (pts.length - 1), 2) * out.tipK;
      out.col.push(0.75 + tip * 0.5, 0.75 + tip * 0.5, 0.75 + tip * 0.5);
    }
  }
  for (let i = 0; i < pts.length - 1; i++)
    for (let s = 0; s < sides; s++) {
      const a = base + i * (sides + 1) + s, c = a + sides + 1;
      out.idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
}

export function geoOf(out) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  g.setIndex(out.idx);
  g.computeBoundingSphere();
  return g;
}

// merge geometries into one indexed geometry with position/normal/uv/colour
export function mergeIndexed(list) {
  const out = newOut();
  for (const g of list) {
    const off = out.pos.length / 3;
    const n = g.attributes.position.count;
    const { position: P, normal: N, uv: U, color: C } = g.attributes;
    for (let i = 0; i < n; i++) {
      out.pos.push(P.getX(i), P.getY(i), P.getZ(i));
      out.nor.push(N.getX(i), N.getY(i), N.getZ(i));
      out.uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
      out.col.push(C ? C.getX(i) : 1, C ? C.getY(i) : 1, C ? C.getZ(i) : 1);
    }
    const idx = g.index ? g.index.array : [...Array(n).keys()];
    for (const k of idx) out.idx.push(k + off);
  }
  return geoOf(out);
}

// paint a whole geometry one colour (multiplied with instance colour later)
export function tint(g, r, gg = r, b = r) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([r, gg, b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// place a geometry with a transform (position, euler, scale) and return it
export function placed(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );
  return g.applyMatrix4(m);
}

// faceted look: split shared vertices so each triangle gets its own flat normal
export function faceted(g) {
  const f = g.index ? g.toNonIndexed() : g;
  f.computeVertexNormals();
  return f;
}
