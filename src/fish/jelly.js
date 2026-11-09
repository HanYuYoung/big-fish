import * as THREE from 'three';
import { G, COMMON } from '../core/globals.js';

// A moon jelly: a pulsing translucent bell, frilled oral arms and long tentacles.
// aK: 0 bell, 1 oral arm, 2 tentacle. aT: 0 at the attachment -> 1 at the free end.
function jellyGeometry() {
  const pos = [], nor = [], kT = [], idx = [];
  const add = (x, y, z, k, t, nx = 0, ny = 1, nz = 0) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    kT.push(k, t);
    return pos.length / 3 - 1;
  };
  // bell: a dome swept around y
  const rings = 14, segs = 32;
  const bell = [];
  for (let i = 0; i <= rings; i++) {
    const a = (i / rings) * Math.PI * 0.55;
    const r = Math.sin(a) * 0.5 * (1 + 0.12 * Math.pow(i / rings, 4));
    const y = Math.cos(a) * 0.38 - 0.1;
    const row = [];
    for (let j = 0; j < segs; j++) {
      const b = (j / segs) * Math.PI * 2;
      const scallop = i === rings ? 1 + 0.06 * Math.cos(b * 16) : 1;
      const nx = Math.sin(a) * Math.cos(b), ny = Math.cos(a), nz = Math.sin(a) * Math.sin(b);
      row.push(add(r * scallop * Math.cos(b), y, r * scallop * Math.sin(b), 0, i / rings, nx, ny, nz));
    }
    bell.push(row);
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % segs;
      idx.push(bell[i][j], bell[i + 1][j], bell[i][j2], bell[i][j2], bell[i + 1][j], bell[i + 1][j2]);
    }
  // ribbons hanging down: oral arms (wide, frilly) and tentacles (thin)
  const ribbon = (x, z, len, width, k, n, twist) => {
    const verts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = width * (k === 1 ? 1 - t * 0.6 : 1 - t * 0.8);
      const y = -0.08 - t * len;
      const ang = twist + t * 2.0;
      const dx = Math.cos(ang) * w, dz = Math.sin(ang) * w;
      verts.push([add(x - dx, y, z - dz, k, t, -dz, 0, dx), add(x + dx, y, z + dz, k, t, -dz, 0, dx)]);
    }
    for (let i = 0; i < n; i++) idx.push(verts[i][0], verts[i + 1][0], verts[i][1], verts[i][1], verts[i + 1][0], verts[i + 1][1]);
  };
  for (let a = 0; a < 4; a++) {
    const b = (a / 4) * Math.PI * 2 + 0.4;
    ribbon(Math.cos(b) * 0.06, Math.sin(b) * 0.06, 0.9, 0.07, 1, 24, b);
  }
  for (let a = 0; a < 18; a++) {
    const b = (a / 18) * Math.PI * 2;
    ribbon(Math.cos(b) * 0.47, Math.sin(b) * 0.47, 1.5 + 0.6 * ((a * 7) % 5) / 5, 0.008, 2, 30, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aKT', new THREE.Float32BufferAttribute(kT, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

let GEO = null;
export class JellyModel {
  constructor(hue = 0) {
    GEO = GEO || jellyGeometry();
    this.U = {
      ...G,
      uPulse: { value: 0 },
      uPhase: { value: Math.random() * 10 },
      uDrift: { value: new THREE.Vector2() },
      uCol: { value: hue ? new THREE.Vector3(0.5, 0.75, 1.0) : new THREE.Vector3(1.0, 0.55, 0.85) },
      uFlash: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.U,
      vertexShader: /* glsl */ `
        attribute vec2 aKT;
        uniform float uPulse, uPhase;
        uniform vec2 uDrift;
        varying vec3 vWP; varying vec3 vN; varying vec2 vKT;
        void main(){
          vec3 p = position;
          float k = aKT.x, t = aKT.y;
          if (k < 0.5) {
            // the bell squeezes and relaxes
            float sq = uPulse * smoothstep(0.3, 1.0, t);
            p.xz *= 1.0 - 0.22 * sq;
            p.y += 0.06 * uPulse * (1.0 - t);
          } else {
            float sw = sin(t * (k > 1.5 ? 9.0 : 5.0) - uPhase * 1.7 + p.x * 4.0);
            p.x += sw * 0.06 * t * (k > 1.5 ? 1.4 : 0.8) - uDrift.x * t * t * 0.6;
            p.z += cos(t * 7.0 - uPhase * 1.3 + p.z * 5.0) * 0.05 * t;
            p.y -= uDrift.y * t * t * 0.4;
            p.xz *= 1.0 - 0.18 * uPulse * (1.0 - t);
          }
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWP = wp.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          vKT = aKT;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: COMMON + /* glsl */ `
        uniform vec3 uCol;
        uniform float uFlash;
        varying vec3 vWP; varying vec3 vN; varying vec2 vKT;
        void main(){
          vec3 N = normalize(vN), V = normalize(cameraPosition - vWP);
          float fres = pow(1.0 - abs(dot(N, V)), 2.0);
          float k = vKT.x, t = vKT.y;
          vec3 base = uCol;
          float a;
          if (k < 0.5) {
            // gonad rings showing through the bell
            float ring = smoothstep(0.07, 0.0, abs(t - 0.42));
            base = mix(base, base * vec3(1.2, 0.8, 1.1), ring);
            a = 0.16 + fres * 0.65 + ring * 0.2;
          } else if (k < 1.5) {
            a = 0.35 * (1.0 - t * 0.6);
          } else {
            a = 0.5 * (1.0 - t);
          }
          float lit = 0.6 + 0.4 * max(dot(N, uLightDir), 0.0);
          vec3 col = base * (uShallow * 0.8 + uSunCol * 0.35 * lit) + base * fres * 0.6;
          col += base * uBio * (0.9 + 0.6 * fres) * (k > 1.5 ? 0.6 : 1.0);
          col = mix(col, vec3(2.0), uFlash);
          vec3 fogged = applyWaterFog(col, vWP);
          float fogK = 1.0 - exp(-length(vWP - cameraPosition) * uFogDen * 1.2);
          gl_FragColor = vec4(fogged, a * (1.0 - fogK * 0.8));
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(GEO, mat);
    this.mesh.renderOrder = 3;
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.size = 1;
  }
  setSize(s) {
    this.size = s;
    this.mesh.scale.setScalar(s);
  }
  setFlash(k) {
    this.U.uFlash.value = k;
  }
  dispose() {
    this.mesh.material.dispose();
  }
}
