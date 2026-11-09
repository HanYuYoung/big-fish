import * as THREE from 'three';
import { G, COMMON, WORLD } from '../core/globals.js';
import { Rng, fbm, smoothstep } from '../core/rng.js';
import { TEX, MODELS } from '../core/assets.js';
import { newOut, tubeAlong, geoOf, mergeIndexed, tint } from './geo.js';
import {
  starfishGeo, urchinGeo, shellGeo, pebbleGeo, bubbleCoralGeo, seaWhipGeo, softCoralGeo,
  hullGeo, mastGeo, barrelGeo, cannonGeo, anchorGeo, chestGeos, goldGeo,
  icebergGeo, icicleGeo, basaltGeo, smokerGeo,
} from './props.js';

// ---------------------------------------------------------------------------
// Floor height. The gameplay plane is z = 0; behind it the floor climbs into
// reef walls that close off the view.
// ---------------------------------------------------------------------------
export function floorY(x, z = 0) {
  const dunes = (fbm(x * 0.05 + 3, z * 0.05, 4) - 0.5) * 3.2 + Math.sin(x * 0.11 + z * 0.07) * 0.5;
  const back = smoothstep(-14, -55, z) * (14 + 18 * fbm(x * 0.02, 7.7, 4));
  const front = smoothstep(4, 16, z) * -2;
  const walls = smoothstep(WORLD.W - 8, WORLD.W + 14, Math.abs(x)) * 26;
  return WORLD.FLOOR + 1.2 + dunes + back + front + walls;
}

// how far the ice sheet hangs below the surface: thin over the play area, ridged behind
function iceThick(x, z) {
  const behind = smoothstep(-3, -16, z);
  const ridge = Math.pow(Math.abs(Math.sin(x * 0.06 + fbm(x * 0.03, z * 0.05, 3) * 4)), 6);
  return 0.35 + 0.6 * fbm(x * 0.08, z * 0.1, 3) + behind * (fbm(x * 0.03 + 9, z * 0.05, 4) * 5 + ridge * 3);
}

// generic lit shader for scenery: texture or flat colour, caustics, fog, optional sway,
// plus a few looks: planked wood (with rotten holes), algae growth, ice
function sceneryMaterial({
  map = null, color = [1, 1, 1], uvScale = 1, triplanar = false, sway = 0, emissive = 0, alphaMap = null,
  side = THREE.FrontSide, vcol = false, groove = 0, wood = 0, holes = false, moss = 0, ice = false, snowK = 1,
} = {}) {
  const defines = {};
  if (map) defines.USE_MAP = 1;
  if (triplanar) defines.TRIPLANAR = 1;
  if (vcol) defines.VCOL = 1;
  if (alphaMap) defines.ALPHA = 1;
  if (groove) defines.GROOVE = 1;
  if (wood) defines.WOOD = 1;
  if (holes) defines.HOLES = 1;
  if (ice) defines.ICE = 1;
  return new THREE.ShaderMaterial({
    defines,
    uniforms: {
      ...G,
      tMap: { value: map },
      tAlpha: { value: alphaMap },
      uTint: { value: new THREE.Vector3(...color) },
      uUV: { value: uvScale },
      uSway: { value: sway },
      uEmit: { value: emissive },
      uPlanks: { value: wood },
      uMoss: { value: moss },
      uSnowK: { value: snowK },
    },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uSway;
      varying vec3 vWP; varying vec3 vN; varying vec2 vUv; varying vec3 vOP; varying vec3 vC;
      void main(){
        vec3 p = position;
        mat4 im = mat4(1.0);
        #ifdef USE_INSTANCING
          im = instanceMatrix;
        #endif
        vec3 base = (modelMatrix * im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec4 wp = modelMatrix * im * vec4(p, 1.0);
        if (uSway > 0.0) {
          float h = max(p.y, 0.0);
          float ph = uTime * 0.9 + base.x * 0.3 + base.z * 0.2;
          wp.x += sin(ph) * uSway * h * h * 0.05 + sin(ph * 2.3 + p.y) * uSway * h * 0.015;
          wp.z += cos(ph * 0.7) * uSway * h * h * 0.03;
        }
        vWP = wp.xyz;
        vN = normalize(mat3(modelMatrix * im) * normal);
        vUv = uv;
        vOP = p;
        vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        #ifdef VCOL
          vC *= color;
        #endif
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: COMMON + /* glsl */ `
      uniform sampler2D tMap; uniform sampler2D tAlpha;
      uniform vec3 uTint; uniform float uUV; uniform float uEmit; uniform float uPlanks; uniform float uMoss; uniform float uSnowK;
      varying vec3 vWP; varying vec3 vN; varying vec2 vUv; varying vec3 vOP; varying vec3 vC;
      void main(){
        vec3 N = normalize(vN);
        if (!gl_FrontFacing) N = -N;
        vec3 alb = uTint * vC;
        #ifdef USE_MAP
          #ifdef TRIPLANAR
            vec3 bw = pow(abs(N), vec3(4.0)); bw /= dot(bw, vec3(1.0));
            vec3 tx = texture2D(tMap, vWP.zy * uUV).rgb * bw.x + texture2D(tMap, vWP.xz * uUV).rgb * bw.y + texture2D(tMap, vWP.xy * uUV).rgb * bw.z;
          #else
            vec3 tx = texture2D(tMap, vUv * uUV).rgb;
          #endif
          alb *= pow(tx, vec3(2.2)) * 1.6;
        #endif
        #ifdef WOOD
          // planks with dark seams, board-to-board variation and grain
          float pl = vUv.y * uPlanks;
          float row = floor(pl);
          float seam = smoothstep(0.0, 0.1, fract(pl)) * smoothstep(1.0, 0.9, fract(pl));
          float board = hash12(vec2(row, floor(vUv.x * 6.0 + hash12(vec2(row, 3.0)) * 6.0)));
          float grain = vnoise(vec2(vUv.x * 140.0, pl * 5.0));
          alb *= (0.6 + 0.35 * board + 0.25 * grain) * (0.4 + 0.6 * seam);
          #ifdef HOLES
            // rotten-through planks on the hull skin (the ribs are painted darker and stay)
            if (vC.r > 0.95 && vnoise(vUv * vec2(9.0, 6.0) + 4.0) * (0.65 + 0.35 * vnoise(vUv * vec2(50.0, 20.0))) > 0.55) discard;
          #endif
        #endif
        #ifdef GROOVE
          // brain-coral meanders
          float m = sin(fbm2(vOP.xz * 6.0 + vOP.y * 3.0) * 34.0);
          alb *= 0.65 + 0.35 * smoothstep(-0.2, 0.6, m);
        #endif
        // algae on whatever faces the light
        if (uMoss > 0.0) alb = mix(alb, vec3(0.16, 0.3, 0.1), smoothstep(0.25, 0.85, N.y) * uMoss * (0.45 + 0.55 * vnoise(vWP.xz * 1.7 + vWP.y)));
        // a dusting of snow in the polar sea
        if (uSnow > 0.0) alb = mix(alb, vec3(0.78, 0.86, 0.94), smoothstep(0.5, 0.85, N.y) * uSnow * uSnowK * (0.55 + 0.45 * vnoise(vWP.xz * 2.0)));
        float a = 1.0;
        #ifdef ALPHA
          a = texture2D(tAlpha, vUv).a;
          if (a < 0.4) discard;
        #endif
        float ndl = max((dot(N, uLightDir) + 0.35) / 1.35, 0.0);
        vec3 amb = mix(uDeep * 2.2 + 0.015, uShallow * 1.15, N.y * 0.5 + 0.5);
        vec3 col = alb * (amb + uSunCol * (ndl * 0.7 + causticLight(vWP, N) * 1.4) + lavaLight(vWP, N));
        col += alb * uEmit * (0.6 + 0.4 * sin(uTime * 1.3 + vWP.x * 0.7));
        #ifdef ICE
          // glassy ice: light soaks through thin edges, facets glint
          vec3 V = normalize(cameraPosition - vWP);
          float fr = pow(1.0 - abs(dot(N, V)), 2.5);
          float up = 1.0 - depth01(vWP.y) * 0.7;
          vec3 icy = vec3(0.55, 0.82, 1.0);
          col = alb * icy * (amb * 0.9 + uSunCol * ndl * 0.18) + uSunCol * icy * (0.04 + fr * 0.3) * up;
          col += uSunCol * pow(max(dot(reflect(-uLightDir, N), V), 0.0), 20.0) * 0.25;
        #endif
        gl_FragColor = vec4(applyWaterFog(col, vWP), 1.0);
      }`,
    side,
    vertexColors: vcol,
  });
}

// ---------------------------------------------------------------------------
// procedural corals
// ---------------------------------------------------------------------------
function branchCoral(rng) {
  const out = newOut(1);
  const grow = (p, dir, len, r, depth) => {
    const pts = [p.clone()];
    const d = dir.clone();
    const n = 4;
    for (let i = 1; i <= n; i++) {
      d.x += rng.range(-0.2, 0.2);
      d.z += rng.range(-0.2, 0.2);
      d.y += 0.08;
      d.normalize();
      pts.push(pts[i - 1].clone().addScaledVector(d, len / n));
    }
    tubeAlong(pts, r, r * 0.7, 5, out);
    if (depth < 3) {
      const k = rng.int(2, 3);
      for (let j = 0; j < k; j++) {
        const nd = d.clone().add(new THREE.Vector3(rng.range(-0.9, 0.9), rng.range(0, 0.4), rng.range(-0.9, 0.9))).normalize();
        grow(pts[n], nd, len * rng.range(0.6, 0.8), r * 0.72, depth + 1);
      }
    }
  };
  for (let i = 0; i < 3; i++) grow(new THREE.Vector3(rng.range(-0.2, 0.2), 0, rng.range(-0.2, 0.2)), new THREE.Vector3(rng.range(-0.5, 0.5), 1, rng.range(-0.5, 0.5)).normalize(), 0.9, 0.1, 0);
  return geoOf(out);
}
function anemoneGeo(rng) {
  const out = newOut(2);
  // column
  tubeAlong([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(0, 0.45, 0)], 0.32, 0.4, 14, out);
  for (let i = 0; i < 70; i++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 0.38;
    const p = new THREE.Vector3(Math.cos(a) * r, 0.45, Math.sin(a) * r);
    const dir = new THREE.Vector3(Math.cos(a) * r * 1.6, 1, Math.sin(a) * r * 1.6).normalize();
    const pts = [p];
    for (let k = 1; k <= 4; k++) pts.push(p.clone().addScaledVector(dir, k * 0.13));
    tubeAlong(pts, 0.03, 0.012, 4, out);
  }
  return geoOf(out);
}
function tableCoral() {
  const out = newOut(0.5);
  tubeAlong([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.4, 0), new THREE.Vector3(0, 0.75, 0.02)], 0.12, 0.08, 8, out);
  const plate = tint(new THREE.CylinderGeometry(1.0, 0.75, 0.12, 24, 1).translate(0, 0.8, 0), 1);
  return mergeIndexed([geoOf(out), plate]);
}
function spongeGeo(rng) {
  const out = newOut(0.6);
  for (let i = 0; i < rng.int(3, 5); i++) {
    const x = rng.range(-0.35, 0.35), z = rng.range(-0.35, 0.35), h = rng.range(0.7, 1.6);
    const lean = new THREE.Vector3(x, 1, z).normalize();
    const pts = [];
    for (let k = 0; k <= 5; k++) pts.push(new THREE.Vector3(x, 0, z).addScaledVector(lean, (h * k) / 5));
    tubeAlong(pts, 0.14, 0.2, 10, out);
  }
  return geoOf(out);
}
function fanTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  const rng = new Rng(4);
  const branch = (x, y, a, len, w, d) => {
    const x2 = x + Math.cos(a) * len, y2 = y - Math.sin(a) * len;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
    if (d < 6) {
      branch(x2, y2, a + rng.range(0.15, 0.45), len * 0.78, w * 0.75, d + 1);
      branch(x2, y2, a - rng.range(0.15, 0.45), len * 0.78, w * 0.75, d + 1);
    }
  };
  branch(128, 256, Math.PI / 2, 60, 8, 0);
  // fine cross-lattice
  g.globalAlpha = 0.5;
  g.lineWidth = 1;
  for (let i = 0; i < 300; i++) {
    const a = rng.range(0, Math.PI), r = rng.range(20, 230);
    const x = 128 + Math.cos(a) * r, y = 256 - Math.sin(a) * r;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rng.range(-12, 12), y + rng.range(-12, 12));
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}
function kelpGeo(rng, height) {
  // a long stipe with blades alternating up its length
  const out = newOut();
  const pts = [];
  for (let i = 0; i <= 16; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.5) * 0.15, (i / 16) * height, 0));
  tubeAlong(pts, 0.05, 0.03, 4, out);
  const blades = newOut();
  for (let i = 2; i < 30; i++) {
    const y = (i / 30) * height;
    const side = i % 2 ? 1 : -1;
    const L = rng.range(0.9, 1.6), W = rng.range(0.16, 0.26);
    const base = blades.pos.length / 3;
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const x = side * t * L;
      const yy = y - t * L * 0.35 + Math.sin(t * 3) * 0.08;
      const w = W * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05));
      blades.pos.push(x, yy + w, 0.02 * side, x, yy - w, -0.02 * side);
      blades.nor.push(0, 0.3, 1, 0, 0.3, 1);
      blades.uv.push(t, 1, t, 0);
      blades.col.push(1, 1, 1, 0.8, 0.8, 0.8);
      if (k < 6) {
        const a = base + k * 2;
        blades.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  return mergeIndexed([geoOf(out), geoOf(blades)]);
}
function grassGeo(rng) {
  const out = newOut();
  for (let b = 0; b < 9; b++) {
    const x = rng.range(-0.4, 0.4), z = rng.range(-0.4, 0.4), h = rng.range(0.5, 1.3), lean = rng.range(-0.3, 0.3);
    const base = out.pos.length / 3;
    for (let k = 0; k <= 4; k++) {
      const t = k / 4, w = 0.035 * (1 - t);
      out.pos.push(x - w + lean * t * t, t * h, z, x + w + lean * t * t, t * h, z);
      out.nor.push(0, 0.5, 1, 0, 0.5, 1);
      out.uv.push(0, t, 1, t);
      out.col.push(0.5 + t * 0.6, 0.5 + t * 0.6, 0.5 + t * 0.6, 0.5 + t * 0.6, 0.5 + t * 0.6, 0.5 + t * 0.6);
      if (k < 4) {
        const a = base + k * 2;
        out.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  return geoOf(out);
}
function wormGeo(rng) {
  const out = newOut();
  for (let i = 0; i < 9; i++) {
    const x = rng.range(-0.5, 0.5), z = rng.range(-0.5, 0.5), h = rng.range(0.8, 2.2);
    const pts = [];
    for (let k = 0; k <= 6; k++) pts.push(new THREE.Vector3(x + Math.sin(k * 0.6 + i) * 0.04, (h * k) / 6, z));
    tubeAlong(pts, 0.07, 0.06, 6, out);
  }
  return geoOf(out);
}

// Instances are bucketed into strips along x so the strips off screen get culled.
function scatterInstanced(group, geo, mat, items, name) {
  if (!items.length) return;
  const buckets = new Map();
  for (const it of items) {
    const k = Math.floor(it.x / 26);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(it);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  for (const list of buckets.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      e.set(it.rx || 0, it.ry || 0, it.rz || 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.sy ?? it.s, it.s));
      im.setMatrixAt(i, m);
      if (it.c) im.setColorAt(i, c.setRGB(...it.c));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    // swaying tips can lean a little past the computed bounds
    im.boundingSphere.radius += 2;
    im.name = name;
    group.add(im);
  }
}

const gauss = (rng) => (rng.next() + rng.next() + rng.next() - 1.5) / 1.5;

// ---------------------------------------------------------------------------
export class Ocean {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.clams = [];
    this.vents = [];
    this.anemones = [];
    this.hazards = [];
    this.backdrop = this.makeBackdrop();
    scene.add(this.backdrop);
  }

  makeBackdrop() {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: G,
        vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
        fragmentShader: COMMON + /* glsl */ `varying vec3 vD; void main(){ vec3 rd = normalize(vD); gl_FragColor = vec4(waterCol(cameraPosition.y + rd.y * 70.0, rd), 1.0); }`,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    m.frustumCulled = false;
    m.renderOrder = -10;
    m.onBeforeRender = (r, s, cam) => {
      m.position.copy(cam.position);
      m.updateMatrixWorld();
    };
    return m;
  }

  build(level, seed = 1) {
    if (this.group) {
      this.scene.remove(this.group);
      const seen = new Set();
      this.group.traverse((o) => {
        if (o.geometry && !seen.has(o.geometry)) {
          seen.add(o.geometry);
          o.geometry.dispose();
        }
        if (o.material && !seen.has(o.material)) {
          seen.add(o.material);
          o.material.dispose();
        }
      });
    }
    const rng = new Rng(seed * 101 + 7);
    const P = level.props;
    const g = (this.group = new THREE.Group());
    g.name = 'ocean';
    this.clams = [];
    this.vents = [];
    this.anemones = [];
    this.hazards = [];
    this.level = level;

    g.add(level.ice ? this.makeIceSheet() : this.makeSurface());
    if (level.bio < 0.5 && !level.lava) g.add(this.makeShafts(rng, level));
    g.add(this.makeFloor(level));
    this.addRocks(g, rng, P.rocks, level);
    if (P.coral > 0) this.addCorals(g, rng, P.coral, level);
    if (P.anemone > 0) this.addAnemones(g, rng, P.anemone, level);
    if ((P.grass ?? 1) > 0) this.addGrass(g, rng, level);
    if (P.kelp > 0) this.addKelp(g, rng, P.kelp);
    if (P.wreck) this.addWreck(g, rng);
    if (level.ice) this.addIcebergs(g, rng);
    if (P.basalt) this.addBasalt(g, rng, P.basalt);
    if (P.vents > 0) this.addVents(g, rng, P.vents);
    if (P.hot) this.addHotVents(g, rng, P.hot);
    if (P.worms > 0) this.addWorms(g, rng);
    this.addFloorBits(g, rng, level);
    if (P.chests) this.addChests(g, rng, P.chests);
    else this.addClams(g, rng, P.clams);
    g.add((this.snow = this.makeSnow(rng, level)));
    this.scene.add(g);
  }

  makeSurface() {
    const geo = new THREE.PlaneGeometry(600, 260, 1, 1);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, WORLD.SURFACE, -80);
    const m = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: G,
        vertexShader: /* glsl */ `varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: COMMON + /* glsl */ `
          varying vec3 vWP;
          void main(){
            vec3 rd = normalize(vWP - cameraPosition);
            vec2 p = vWP.xz * 0.12;
            float n1 = fbm2(p + uTime * 0.08), n2 = fbm2(p * 2.3 - uTime * 0.11);
            vec3 N = normalize(vec3((n1 - 0.5) * 0.9, -1.0, (n2 - 0.5) * 0.9));
            // inside Snell's window the sky shows through, outside the surface mirrors the deep
            float cosI = -dot(rd, N);
            float window = smoothstep(0.6, 0.75, cosI);
            vec3 sky = uSunCol * (0.9 + 0.6 * n1) + vec3(0.3, 0.5, 0.6);
            vec3 mirror = mix(uShallow, uDeep, 0.35) * (0.7 + 0.6 * n2);
            vec3 col = mix(mirror, sky, window);
            col += uSunCol * pow(caustic(vWP.xz * 0.03, uTime * 0.4), 1.0) * 0.35;
            col *= 1.0 - max(uBio, uLava) * 0.92;
            gl_FragColor = vec4(applyWaterFog(col, vWP), 1.0);
          }`,
        side: THREE.DoubleSide,
        depthWrite: true,
      })
    );
    m.name = 'surface';
    return m;
  }

  // the polar sea is roofed with pack ice: thin and glowing overhead, thick ridges behind
  makeIceSheet() {
    const geo = new THREE.PlaneGeometry(600, 150, 300, 75);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -50);
    const p = geo.attributes.position;
    const thick = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const d = iceThick(x, z);
      thick[i] = d;
      p.setY(i, WORLD.SURFACE + 0.4 - d);
    }
    geo.setAttribute('aThick', new THREE.BufferAttribute(thick, 1));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: G,
        vertexShader: /* glsl */ `
          attribute float aThick; varying vec3 vWP; varying vec3 vN; varying float vT;
          void main(){ vT = aThick; vN = normal; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: COMMON + /* glsl */ `
          varying vec3 vWP; varying vec3 vN; varying float vT;
          void main(){
            vec3 N = normalize(vN);
            if (N.y > 0.0) N = -N;
            vec2 p = vWP.xz;
            float thin = exp(-vT * 0.55);
            vec2 c = cellular(p * 0.16 + vec2(0.0, uTime * 0.004));
            float crack = 1.0 - smoothstep(0.0, 0.06, c.y - c.x);
            float n = fbm2(p * 0.35);
            vec3 deepIce = vec3(0.08, 0.3, 0.5);
            vec3 glow = vec3(0.7, 0.95, 1.1);
            vec3 col = mix(deepIce, glow, thin * (0.75 + 0.5 * n)) * uSunCol * 0.6;
            col += uSunCol * vec3(0.85, 0.97, 1.0) * crack * (0.25 + thin) * 0.8;
            vec3 V = normalize(cameraPosition - vWP);
            col += pow(1.0 - abs(dot(N, V)), 3.0) * vec3(0.4, 0.6, 0.7) * 0.4;
            col += uSunCol * pow(caustic(vWP.xz * 0.03, uTime * 0.25), 1.0) * 0.12 * thin;
            gl_FragColor = vec4(applyWaterFog(col, vWP), 1.0);
          }`,
        side: THREE.DoubleSide,
      })
    );
    m.name = 'ice';
    return m;
  }

  makeShafts(rng, level) {
    const grp = new THREE.Group();
    grp.name = 'shafts';
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...G, uK: { value: level.shafts ?? 1 } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        varying vec2 vUv; varying vec3 vWP; varying float vSeed;
        void main(){ vUv = uv; vSeed = aSeed; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: COMMON + /* glsl */ `
        uniform float uK;
        varying vec2 vUv; varying vec3 vWP; varying float vSeed;
        void main(){
          float across = clamp(1.0 - abs(vUv.x * 2.0 - 1.0), 0.0, 1.0);
          float flick = 0.55 + 0.45 * sin(uTime * (0.4 + vSeed * 0.5) + vSeed * 30.0) * sin(uTime * 0.23 + vSeed * 9.0);
          float streak = 0.6 + 0.4 * vnoise(vec2(vUv.x * 6.0 + vSeed * 10.0, vUv.y * 2.0 + uTime * 0.1));
          float a = pow(across, 2.2) * pow(clamp(vUv.y, 0.0, 1.0), 1.6) * max(flick, 0.0) * streak;
          float camD = length(vWP - cameraPosition);
          a *= smoothstep(3.0, 12.0, camD);
          gl_FragColor = vec4(uSunCol * 0.085 * a * uK, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 18; i++) {
      const w = rng.range(1.5, 6);
      const len = WORLD.SURFACE - WORLD.FLOOR + 4;
      const geo = new THREE.PlaneGeometry(w, len);
      geo.translate(0, -len / 2, 0);
      const s = rng.next();
      geo.setAttribute('aSeed', new THREE.Float32BufferAttribute([s, s, s, s], 1));
      const m = new THREE.Mesh(geo, mat);
      m.position.set(rng.range(-WORLD.W - 10, WORLD.W + 10), WORLD.SURFACE, rng.range(-30, 6));
      m.rotation.z = -0.32 + rng.range(-0.05, 0.05);
      m.renderOrder = 5;
      grp.add(m);
    }
    return grp;
  }

  makeFloor(level) {
    const sx = 2 * WORLD.W + 160, z0 = -75, z1 = 14;
    const nx = 300, nz = 90;
    const pos = [], idx = [];
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const x = -sx / 2 + (i / nx) * sx;
        const z = z0 + (j / nz) * (z1 - z0);
        pos.push(x, floorY(x, z), z);
      }
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const sand = TEX.coast_sand_01, rock = TEX.lichen_rock;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...G, tSand: { value: sand.map }, tSandN: { value: sand.normalMap }, tRock: { value: rock.map },
        uDark: { value: level.bio }, uSandTint: { value: new THREE.Vector3(...(level.sand || [1, 1, 1])) },
      },
      vertexShader: /* glsl */ `varying vec3 vWP; varying vec3 vN; void main(){ vWP = position; vN = normal; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
      fragmentShader: COMMON + /* glsl */ `
        uniform sampler2D tSand, tSandN, tRock; uniform float uDark; uniform vec3 uSandTint;
        varying vec3 vWP; varying vec3 vN;
        void main(){
          vec3 N = normalize(vN);
          vec2 p = vWP.xz;
          vec3 sand = pow(texture2D(tSand, p * 0.22).rgb, vec3(2.2)) * mix(0.85, 1.15, vnoise(p * 0.05));
          sand = mix(sand, pow(texture2D(tSand, p * 0.06 + 0.3).rgb, vec3(2.2)), 0.35);
          // patches of darker rubble and algae break up the sand
          float patchy = smoothstep(0.45, 0.7, fbm2(p * 0.07 + 11.0));
          sand = mix(sand, sand * vec3(0.55, 0.62, 0.5), patchy * 0.6);
          vec3 rk = pow(texture2D(tRock, p * 0.12).rgb, vec3(2.2));
          float steep = smoothstep(0.75, 0.45, N.y);
          vec3 alb = mix(sand * vec3(1.05, 1.0, 0.92) * uSandTint, rk * vec3(0.8, 0.85, 0.9), steep);
          alb = mix(alb, alb * vec3(0.35, 0.4, 0.55), uDark);
          alb = mix(alb, vec3(0.8, 0.86, 0.93), smoothstep(0.5, 0.85, N.y) * uSnow * (0.65 + 0.35 * vnoise(p * 0.4)));
          vec2 tn = texture2D(tSandN, p * 0.22).xy * 2.0 - 1.0;
          N = normalize(N + vec3(tn.x, 0.0, -tn.y) * 0.5 * (1.0 - steep));
          float ndl = max((dot(N, uLightDir) + 0.3) / 1.3, 0.0);
          vec3 amb = mix(uDeep * 2.0 + 0.012, uShallow * 1.1, N.y * 0.5 + 0.5);
          vec3 col = alb * (amb + uSunCol * (ndl * 0.6 + causticLight(vWP, N) * 1.8) + lavaLight(vWP, N));
          // bioluminescent specks in the deep
          float sp = step(0.997, hash12(floor(p * 3.0))) * uBio;
          col += vec3(0.2, 0.7, 1.0) * sp * (0.5 + 0.5 * sin(uTime * 2.0 + p.x));
          if (uLava > 0.0) {
            // black crust split by glowing cracks
            vec2 c = cellular(p * 0.45 + vnoise(p * 0.3) * 0.6);
            float crack = 1.0 - smoothstep(0.015, 0.09, c.y - c.x);
            float field = smoothstep(0.42, 0.6, fbm2(p * 0.045 + 7.0)) * smoothstep(0.78, 0.92, normalize(vN).y);
            float pulse = 0.65 + 0.35 * sin(uTime * 1.2 + p.x * 0.35 + p.y * 0.25);
            col *= 1.0 - field * 0.5;
            col += uLavaCol * uLava * crack * field * pulse * (0.8 + 0.6 * vnoise(p * 2.0));
            col += uLavaCol * uLava * field * 0.05 * pulse;
          }
          gl_FragColor = vec4(applyWaterFog(col, vWP), 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'floor';
    return mesh;
  }

  addRocks(g, rng, k, level) {
    const meshes = [];
    for (const id of ['rock_moss_set_01', 'rock_moss_set_02']) {
      MODELS[id].updateMatrixWorld(true);
      MODELS[id].traverse((o) => {
        if (o.isMesh) {
          const geo = o.geometry.clone();
          const m = o.matrixWorld.clone();
          m.setPosition(0, 0, 0);
          geo.applyMatrix4(m);
          geo.computeBoundingBox();
          // decoded by hand in the shader, so sample it raw
          o.material.map.colorSpace = THREE.NoColorSpace;
          o.material.map.needsUpdate = true;
          meshes.push({ geo, map: o.material.map });
        }
      });
    }
    const tint3 = level.rock || [0.95, 0.85, 0.95];
    const mat = sceneryMaterial({ map: meshes[0].map, color: tint3 });
    const lists = meshes.map(() => []);
    const place = (x, z, s, sink = 0.35) => {
      const i = rng.int(0, meshes.length - 1);
      const bb = meshes[i].geo.boundingBox;
      lists[i].push({ x, y: floorY(x, z) - bb.min.y * s * (1 - sink), z, s, sy: s * rng.range(0.6, 1.3), ry: rng.range(0, 6.28), rx: rng.range(-0.2, 0.2) });
    };
    const N = Math.round(70 * k);
    for (let i = 0; i < N; i++) {
      const z = rng.range(-26, 3);
      place(rng.range(-WORLD.W - 20, WORLD.W + 20), z, z > -4 ? rng.range(0.35, 0.9) : rng.range(0.8, 3.2));
    }
    // big outcrops behind the play area
    for (let i = 0; i < Math.round(26 * k); i++) place(rng.range(-WORLD.W - 30, WORLD.W + 30), rng.range(-50, -18), rng.range(4, 11), 0.45);
    meshes.forEach((m, i) => scatterInstanced(g, m.geo, mat, lists[i], 'rocks'));
  }

  addCorals(g, rng, k, level) {
    const palette = level.coralPalette || [[1.3, 0.35, 0.5], [1.35, 0.55, 0.2], [0.8, 0.35, 1.2], [1.3, 0.95, 0.3], [0.35, 1.0, 1.0], [1.35, 0.3, 0.3], [1.2, 0.5, 0.9]];
    const kinds = [
      { geo: branchCoral(rng), w: 3, s: [0.8, 1.9] },
      { geo: branchCoral(rng), w: 2.5, s: [0.7, 1.7] },
      { geo: tableCoral(), w: 1, s: [0.8, 2.0] },
      { geo: spongeGeo(rng), w: 1.4, s: [0.7, 1.6] },
      { geo: bubbleCoralGeo(rng), w: 1.6, s: [0.9, 1.7], pal: [[1.0, 0.95, 0.75], [0.75, 1.0, 0.85], [1.15, 0.78, 0.9]] },
      { geo: seaWhipGeo(rng), w: 1.8, s: [0.8, 1.5], sway: 0.3 },
      { geo: softCoralGeo(rng), w: 1.6, s: [0.8, 1.5] },
    ];
    const totalW = kinds.reduce((a, kd) => a + kd.w, 0);
    const pickKind = () => {
      let r = rng.next() * totalW;
      for (let i = 0; i < kinds.length; i++) if ((r -= kinds[i].w) <= 0) return i;
      return 0;
    };
    const items = kinds.map(() => []);
    const put = (x, z, scale) => {
      const i = pickKind(), kd = kinds[i];
      const s = rng.range(...kd.s) * scale * (z < -12 ? 1.5 : 1);
      items[i].push({ x, y: floorY(x, z) - 0.15, z, s, ry: rng.range(0, 6.28), c: rng.pick(kd.pal || palette) });
    };
    // reef heads: corals crowd together in patches, with a few loners between
    const patches = Math.round(34 * k);
    for (let p = 0; p < patches; p++) {
      const cx = rng.range(-WORLD.W - 10, WORLD.W + 10);
      const cz = rng.next() < 0.6 ? rng.range(-10, -1.5) : rng.range(-32, -10);
      const R = rng.range(2, 4.5);
      const n = rng.int(5, 11);
      for (let j = 0; j < n; j++) {
        const dx = gauss(rng) * R, dz = gauss(rng) * R * 0.6;
        put(cx + dx, Math.min(3, cz + dz), 1 - (Math.hypot(dx, dz) / R) * 0.3);
      }
    }
    for (let i = 0; i < 40 * k; i++) put(rng.range(-WORLD.W - 10, WORLD.W + 10), rng.range(-24, 3), 0.8);
    kinds.forEach((kd, i) => {
      const mat = sceneryMaterial({ color: [1, 1, 1], vcol: true, emissive: level.bio * 0.5, sway: kd.sway || 0, snowK: 0.4 });
      scatterInstanced(g, kd.geo, mat, items[i], 'coral');
    });
    // brain corals
    const dome = tint(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), 1);
    const bm = sceneryMaterial({ color: [1, 1, 1], vcol: true, groove: 1 });
    const bi = [];
    for (let i = 0; i < 45 * k; i++) {
      const x = rng.range(-WORLD.W - 10, WORLD.W + 10), z = rng.range(-28, 4);
      bi.push({ x, y: floorY(x, z) - 0.2, z, s: rng.range(0.6, 1.6), sy: rng.range(0.4, 0.8), c: rng.pick([[0.85, 0.75, 0.45], [0.6, 0.85, 0.55], [0.95, 0.6, 0.5]]) });
    }
    scatterInstanced(g, dome, bm, bi, 'brain');
    // sea fans
    const fan = new THREE.PlaneGeometry(2.4, 2.4);
    fan.translate(0, 1.2, 0);
    const fanMat = sceneryMaterial({ color: [1, 1, 1], alphaMap: fanTexture(), sway: 0.25, side: THREE.DoubleSide });
    const fi = [];
    for (let i = 0; i < 40 * k; i++) {
      const x = rng.range(-WORLD.W - 10, WORLD.W + 10), z = rng.range(-26, 0);
      fi.push({ x, y: floorY(x, z) - 0.1, z, s: rng.range(0.7, 1.7), ry: rng.range(-0.6, 0.6), c: rng.pick([[0.85, 0.2, 0.45], [0.95, 0.5, 0.15], [0.6, 0.25, 0.85]]) });
    }
    scatterInstanced(g, fan, fanMat, fi, 'fans');
  }

  addAnemones(g, rng, k, level) {
    const geo = anemoneGeo(rng);
    const mat = sceneryMaterial({ color: [1, 1, 1], vcol: true, sway: 0.6, emissive: 0.08, snowK: 0 });
    const items = [];
    const pal = level.anemonePalette || [[0.75, 0.45, 1.0], [0.4, 1.0, 0.7], [1.0, 0.55, 0.75]];
    for (let i = 0; i < Math.round(14 * k); i++) {
      const x = rng.range(-WORLD.W + 6, WORLD.W - 6), z = rng.range(-3, 1.5);
      const y = floorY(x, z) - 0.1;
      items.push({ x, y, z, s: rng.range(1.4, 2.2), c: rng.pick(pal) });
      this.anemones.push(new THREE.Vector3(x, y + 1.2, 0));
    }
    scatterInstanced(g, geo, mat, items, 'anemone');
  }

  addGrass(g, rng, level) {
    const geo = grassGeo(rng);
    const col = level.grass || [0.35, 0.65, 0.35];
    const mat = sceneryMaterial({ color: col, vcol: true, sway: 1.4, side: THREE.DoubleSide, snowK: 0 });
    const items = [];
    const n = 900 * (level.props.grass ?? 1);
    for (let i = 0; i < n; i++) {
      const x = rng.range(-WORLD.W - 20, WORLD.W + 20), z = rng.range(-22, 8);
      if (fbm(x * 0.06, z * 0.06 + 5, 3) < 0.45) continue;
      items.push({ x, y: floorY(x, z) - 0.05, z, s: rng.range(0.7, 1.5), ry: rng.range(0, 6.28) });
    }
    scatterInstanced(g, geo, mat, items, 'grass');
  }

  addKelp(g, rng, k) {
    const variants = [kelpGeo(rng, 24), kelpGeo(rng, 20), kelpGeo(rng, 27)];
    const mat = sceneryMaterial({ color: [0.55, 0.62, 0.22], vcol: true, sway: 0.08, side: THREE.DoubleSide });
    const lists = variants.map(() => []);
    for (let i = 0; i < 120 * k; i++) {
      const x = rng.range(-WORLD.W - 10, WORLD.W + 10);
      // mostly behind the play plane; a few in front as soft silhouettes
      const z = rng.next() < 0.05 * k ? rng.range(4, 8) : rng.range(-34, k < 0.5 ? -9 : -3);
      const v = rng.int(0, 2);
      const y = floorY(x, z) - 0.3;
      const hs = Math.min(1, (WORLD.SURFACE - 1 - y) / 26);
      lists[v].push({ x, y, z, s: rng.range(0.85, 1.15), sy: hs * rng.range(0.85, 1.05), ry: rng.range(-0.8, 0.8) });
    }
    variants.forEach((v, i) => scatterInstanced(g, v, mat, lists[i], 'kelp'));
  }

  // starfish, urchins, shells and pebbles strewn over the sand near the play plane
  addFloorBits(g, rng, level) {
    const B = level.bits || { stars: 1, urchins: 1, shells: 1, pebbles: 1 };
    const spot = (zMin = -9, zMax = 4) => {
      const x = rng.range(-WORLD.W - 10, WORLD.W + 10), z = rng.range(zMin, zMax);
      return { x, z, y: floorY(x, z) };
    };
    const bits = [
      { geo: starfishGeo(), n: 70 * (B.stars || 0), s: [0.35, 0.7], lift: 0.02, pal: level.starPalette || [[1.4, 0.45, 0.15], [1.3, 0.2, 0.25], [0.35, 0.55, 1.3], [1.4, 0.9, 0.3]], tilt: 0.12 },
      { geo: urchinGeo(), n: 60 * (B.urchins || 0), s: [0.5, 0.9], lift: 0.05, pal: [[0.35, 0.12, 0.45], [0.12, 0.1, 0.14], [0.6, 0.2, 0.3]] },
      { geo: shellGeo(), n: 80 * (B.shells || 0), s: [0.35, 0.7], lift: 0.0, pal: [[1.1, 0.95, 0.8], [1.2, 0.75, 0.7], [0.95, 0.85, 1.0]], tilt: 0.2 },
      { geo: pebbleGeo(1), n: 160 * (B.pebbles || 0), s: [0.15, 0.45], lift: 0.02, pal: level.pebblePalette || [[0.6, 0.58, 0.55], [0.45, 0.43, 0.42], [0.75, 0.7, 0.62]] },
    ];
    for (const b of bits) {
      if (b.n <= 0) continue;
      const items = [];
      for (let i = 0; i < b.n; i++) {
        const p = spot();
        items.push({ x: p.x, y: p.y + b.lift, z: p.z, s: rng.range(...b.s), ry: rng.range(0, 6.28), rx: rng.range(-1, 1) * (b.tilt || 0), rz: rng.range(-1, 1) * (b.tilt || 0), c: rng.pick(b.pal) });
      }
      scatterInstanced(g, b.geo, sceneryMaterial({ color: [1, 1, 1], vcol: true, snowK: 0.3 }), items, 'bits');
    }
  }

  // ---------------------------------------------------------------- 沉船湾
  addWreck(g, rng) {
    const wood = sceneryMaterial({ color: [0.62, 0.46, 0.32], vcol: true, wood: 22, holes: true, moss: 0.75, side: THREE.DoubleSide });
    const beams = sceneryMaterial({ color: [0.55, 0.42, 0.3], vcol: true, wood: 3, moss: 0.6 });
    const add = (geo, mat, x, y, z, rx, ry, rz, s = 1) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.scale.setScalar(s);
      m.name = 'wreck';
      g.add(m);
      return m;
    };
    // the main hull lies half-buried, listing to one side
    const hx = -16, hz = -11;
    add(hullGeo(30, 4, 5), wood, hx, floorY(hx, hz) + 2.4, hz, 0.22, 0.18, -0.12);
    add(mastGeo(19), beams, hx + 3, floorY(hx, hz) + 2.2, hz + 0.5, 0.15, 0.4, -0.38);
    // the broken stern further along, on its side
    const sx = 34, sz = -16;
    add(hullGeo(13, 3.6, 4.4, true), wood, sx, floorY(sx, sz) + 2.0, sz, 0.55, -0.7, 0.3);
    // a fallen mast across the sand
    add(mastGeo(16), beams, 8, floorY(8, -6) + 0.35, -6, 0.1, 0.35, 1.45);
    const anchor = add(anchorGeo(), sceneryMaterial({ color: [0.2, 0.18, 0.17], vcol: true, moss: 0.5 }), -40, floorY(-40, -4) - 0.6, -4, 0.1, 0.3, 0.55, 1.4);
    anchor.name = 'anchor';
    // barrels and cannons scattered from the wreck
    const bi = [], ci = [];
    for (let i = 0; i < 30; i++) {
      const near = rng.next() < 0.6;
      const x = near ? hx + rng.range(-18, 18) : rng.range(-WORLD.W, WORLD.W);
      const z = rng.range(-9, 2);
      const lying = rng.next() < 0.55;
      bi.push({ x, y: floorY(x, z) + (lying ? 0.45 : -0.1), z, s: rng.range(0.8, 1.1), rz: lying ? Math.PI / 2 : rng.range(-0.15, 0.15), ry: rng.range(0, 6.28), c: rng.pick([[0.55, 0.38, 0.24], [0.45, 0.32, 0.22], [0.6, 0.45, 0.3]]) });
    }
    for (let i = 0; i < 10; i++) {
      const x = rng.range(-WORLD.W + 5, WORLD.W - 5), z = rng.range(-8, 1);
      ci.push({ x, y: floorY(x, z) + 0.15, z, s: rng.range(0.9, 1.2), ry: rng.range(0, 6.28), rz: rng.range(-0.15, 0.1), c: [0.22, 0.2, 0.19] });
    }
    scatterInstanced(g, barrelGeo(), sceneryMaterial({ color: [1, 1, 1], vcol: true, moss: 0.55 }), bi, 'barrels');
    scatterInstanced(g, cannonGeo(), sceneryMaterial({ color: [1, 1, 1], vcol: true, moss: 0.45 }), ci, 'cannons');
  }

  // treasure chests on the play plane: their lids lift now and then to show gold
  addChests(g, rng, n) {
    const { base, lid } = chestGeos();
    const mat = sceneryMaterial({ color: [0.55, 0.36, 0.2], vcol: true, wood: 5, moss: 0.35 });
    const gold = goldGeo(rng);
    const goldMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.3, 0.6) });
    for (let i = 0; i < n; i++) {
      const x = -WORLD.W + 12 + ((i + 0.5) / n) * (2 * WORLD.W - 24) + rng.range(-6, 6);
      const y = floorY(x, 0);
      const root = new THREE.Group();
      root.position.set(x, y - 0.08, 0.5);
      root.rotation.set(rng.range(-0.06, 0.06), rng.range(-0.35, 0.35), rng.range(-0.06, 0.06));
      root.scale.setScalar(1.15);
      const upperPivot = new THREE.Group();
      upperPivot.position.set(0, 0.75, -0.475);
      upperPivot.add(new THREE.Mesh(lid, mat));
      const pearl = new THREE.Mesh(gold, goldMat);
      root.add(new THREE.Mesh(base, mat), upperPivot, pearl);
      g.add(root);
      this.clams.push({ root, upperPivot, pearl, x, y: y + 0.9, open: 0, timer: rng.range(2, 9), hasPearl: true, regrow: 0, maxOpen: 1.2, kind: 'chest' });
    }
  }

  // ---------------------------------------------------------------- 冰封极海
  addIcebergs(g, rng) {
    const mat = sceneryMaterial({ color: [0.85, 0.93, 1.0], vcol: true, ice: true, snowK: 0 });
    for (let i = 0; i < 9; i++) {
      const x = -WORLD.W - 10 + ((i + rng.range(0.2, 0.8)) / 9) * (2 * WORLD.W + 20);
      const z = rng.range(-55, -22);
      const w = rng.range(3, 7), h = rng.range(9, 22), d = rng.range(3, 6);
      const m = new THREE.Mesh(icebergGeo(rng, w, h, d), mat);
      m.position.set(x, WORLD.SURFACE + 0.6 - 0.55 * h, z);
      m.rotation.y = rng.range(0, 6.28);
      m.name = 'iceberg';
      g.add(m);
    }
    // icicles hanging under the sheet just behind the play plane
    const items = [];
    for (let i = 0; i < 70; i++) {
      // in loose clusters along the pressure ridges, not a picket fence
      const x = rng.range(-WORLD.W - 10, WORLD.W + 10), z = rng.range(-12, -3);
      if (fbm(x * 0.08, z * 0.1 + 3, 2) < 0.48) continue;
      items.push({ x, y: WORLD.SURFACE + 0.5 - iceThick(x, z), z, s: rng.range(0.5, 1.1), sy: rng.range(0.6, 1.3), ry: rng.range(0, 6.28) });
    }
    scatterInstanced(g, icicleGeo(rng), mat, items, 'icicles');
  }

  // ---------------------------------------------------------------- 熔岩海沟
  addBasalt(g, rng, k) {
    const variants = [basaltGeo(rng), basaltGeo(rng), basaltGeo(rng)];
    const mat = sceneryMaterial({ color: [0.16, 0.15, 0.15], vcol: true });
    const lists = variants.map(() => []);
    for (let i = 0; i < 70 * k; i++) {
      const front = rng.next() < 0.12;
      const x = rng.range(-WORLD.W - 15, WORLD.W + 15);
      const z = front ? rng.range(3, 7) : rng.range(-36, -3);
      lists[rng.int(0, 2)].push({ x, y: floorY(x, z) - 0.4, z, s: front ? rng.range(0.5, 0.8) : rng.range(0.8, 2.4) * (z < -14 ? 1.6 : 1), sy: rng.range(0.7, 1.4), ry: rng.range(0, 6.28) });
    }
    variants.forEach((v, i) => scatterInstanced(g, v, mat, lists[i], 'basalt'));
  }

  // hot vents on the play plane: they rumble, then blast a column of scalding water
  addHotVents(g, rng, n) {
    const rockMat = sceneryMaterial({ color: [0.2, 0.17, 0.16], vcol: true });
    const capMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.35), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < n; i++) {
      const x = -WORLD.W + 16 + ((i + 0.5) / n) * (2 * WORLD.W - 32) + rng.range(-5, 5);
      const z = 0.3;
      const y = floorY(x, z);
      const h = rng.range(1.4, 2.4);
      const chim = new THREE.Mesh(smokerGeo(rng, h), rockMat);
      chim.position.set(x, y - 0.3, z);
      g.add(chim);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), capMat.clone());
      cap.rotation.x = -Math.PI / 2;
      cap.position.set(x, y + h - 0.25, z);
      g.add(cap);
      const U = { ...G, uK: { value: 0 }, uSeed: { value: rng.range(0, 50) } };
      const plume = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 13).translate(0, 6.5, 0),
        new THREE.ShaderMaterial({
          uniforms: U,
          vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vWP; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
          fragmentShader: COMMON + /* glsl */ `
            uniform float uK, uSeed; varying vec2 vUv; varying vec3 vWP;
            void main(){
              float x = vUv.x * 2.0 - 1.0, y = vUv.y;
              float w = 0.22 + 0.78 * y;
              float n = fbm2(vec2(x * 2.5 / w, y * 5.0 - uTime * (0.8 + 2.4 * uK)) + uSeed);
              float core = exp(-pow(x / (w * 0.55), 2.0) * 3.0);
              float a = core * (0.35 + 0.9 * n);
              // the column only reaches as high as the eruption has pushed it
              a *= smoothstep(0.15 + 0.85 * uK, 0.05 + 0.6 * uK, y);
              vec3 hot = mix(vec3(3.2, 0.9, 0.2), vec3(4.0, 2.5, 0.9), core * (1.0 - y));
              vec3 col = hot * a * (0.15 + 0.85 * uK) * 0.55;
              gl_FragColor = vec4(col, 1.0);
            }`,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        })
      );
      plume.position.set(x, y + h - 0.3, z + 0.2);
      plume.renderOrder = 4;
      g.add(plume);
      this.hazards.push({ x, y: y + h - 0.3, z, U, state: 'idle', t: rng.range(3, 8), k: 0, cap });
      this.vents.push(new THREE.Vector3(x, y + h - 0.2, z));
    }
  }

  addVents(g, rng, n) {
    const mat = sceneryMaterial({ map: TEX.lichen_rock.map, color: [0.35, 0.3, 0.3], triplanar: true, uvScale: 0.3 });
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 1.2, 0.3), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < n; i++) {
      const x = -WORLD.W + 8 + ((i + rng.range(0.2, 0.8)) / n) * (2 * WORLD.W - 16), z = rng.range(-7, -2);
      const y = floorY(x, z);
      const h = rng.range(3, 6);
      const chim = new THREE.CylinderGeometry(0.5, 1.5, h, 9, 4);
      const pa = chim.attributes.position;
      for (let k = 0; k < pa.count; k++) pa.setXYZ(k, pa.getX(k) * rng.range(0.85, 1.15), pa.getY(k), pa.getZ(k) * rng.range(0.85, 1.15));
      chim.computeVertexNormals();
      const m = new THREE.Mesh(chim, mat);
      m.position.set(x, y + h / 2 - 0.3, z);
      g.add(m);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x, y + h - 0.28, z);
      g.add(glow);
      this.vents.push(new THREE.Vector3(x, y + h - 0.2, z));
    }
  }

  addWorms(g, rng) {
    const geo = wormGeo(rng);
    const mat = sceneryMaterial({ color: [0.95, 0.92, 0.85], vcol: true, sway: 0.15 });
    const plumes = new THREE.SphereGeometry(0.12, 8, 6);
    const pm = sceneryMaterial({ color: [1.0, 0.15, 0.1], emissive: 1.4 });
    const items = [], pi = [];
    for (let i = 0; i < 60; i++) {
      const x = rng.range(-WORLD.W, WORLD.W), z = rng.range(-12, 1);
      const y = floorY(x, z) - 0.1;
      items.push({ x, y, z, s: rng.range(0.8, 1.5) });
      pi.push({ x, y: y + 1.6, z, s: rng.range(1, 2) });
    }
    scatterInstanced(g, geo, mat, items, 'worms');
    scatterInstanced(g, plumes, pm, pi, 'plumes');
  }

  addClams(g, rng, n) {
    // giant clams on the play plane that open now and then to show a pearl
    const shell = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    shell.scale(1, 0.45, 0.8);
    const ribs = shell.attributes.position;
    for (let i = 0; i < ribs.count; i++) {
      const x = ribs.getX(i), z = ribs.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + 0.06 * Math.sin(a * 14);
      ribs.setXYZ(i, x * k, ribs.getY(i), z * k);
    }
    shell.computeVertexNormals();
    const sm = sceneryMaterial({ color: [0.75, 0.62, 0.85], emissive: 0.05 });
    const pearlMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 2.4) });
    const pearlGeo = new THREE.SphereGeometry(0.28, 16, 12);
    for (let i = 0; i < n; i++) {
      const x = -WORLD.W + 12 + ((i + 0.5) / n) * (2 * WORLD.W - 24) + rng.range(-6, 6);
      const y = floorY(x, 0);
      const root = new THREE.Group();
      root.position.set(x, y + 0.1, 0.4);
      const lower = new THREE.Mesh(shell, sm);
      lower.rotation.x = Math.PI;
      const upperPivot = new THREE.Group();
      upperPivot.position.set(0, 0, -0.75);
      const upper = new THREE.Mesh(shell, sm);
      upper.position.set(0, 0, 0.75);
      upperPivot.add(upper);
      const pearl = new THREE.Mesh(pearlGeo, pearlMat);
      pearl.position.set(0, 0.2, 0.1);
      root.add(lower, upperPivot, pearl);
      root.scale.setScalar(1.1);
      g.add(root);
      this.clams.push({ root, upperPivot, pearl, x, y: y + 0.5, open: 0, timer: rng.range(2, 9), hasPearl: true, regrow: 0, maxOpen: 0.85, kind: 'clam' });
    }
  }

  makeSnow(rng, level) {
    const n = level.bio || level.ice || level.lava ? 2400 : 1100;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([rng.next(), rng.next(), rng.next()], i * 3);
      seed[i] = rng.next();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: { ...G, uPR: { value: 1 }, uEmber: { value: level.lava ? 1 : 0 } },
        vertexShader: COMMON + /* glsl */ `
          attribute float aSeed; uniform float uPR; uniform float uEmber;
          varying float vA; varying vec3 vC;
          void main(){
            vec3 box = vec3(70.0, 40.0, 50.0);
            vec3 p = position * box;
            // marine snow drifts down; embers ride the heat upward
            float ember = uEmber * step(0.55, aSeed);
            p.y += uTime * mix(-(0.15 + aSeed * 0.25) * (1.0 + uSnow), 0.5 + aSeed * 0.9, ember);
            p.x += sin(uTime * 0.2 + aSeed * 30.0) * 1.5 + uTime * 0.12;
            vec3 c = cameraPosition + vec3(0.0, 0.0, -18.0);
            vec3 rel = mod(p - c + box * 0.5, box) - box * 0.5;
            vec3 wp = c + rel;
            vec4 mv = viewMatrix * vec4(wp, 1.0);
            gl_Position = projectionMatrix * mv;
            float tw = 0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 50.0);
            float edge = 1.0 - smoothstep(0.6, 1.0, max(abs(rel.x) / (box.x * 0.5), abs(rel.y) / (box.y * 0.5)));
            vA = edge * (0.35 + 0.65 * tw);
            vA *= step(wp.y, uSurfaceY - uIce * 1.0) * (1.0 - exp(-length(wp - cameraPosition) * 0.25));
            // in the deep a quarter of the specks are glowing plankton that pulse
            float glow = step(0.75, aSeed) * uBio;
            float pulse = pow(0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 1.7) + aSeed * 80.0), 3.0);
            vec3 plankton = mix(vec3(0.2, 1.4, 1.6), vec3(0.4, 1.8, 0.9), fract(aSeed * 7.0)) * (0.4 + 2.6 * pulse);
            vC = mix(vec3(0.7, 0.85, 0.9) * (uShallow + 0.25), vec3(0.25, 0.35, 0.5) * 0.5, uBio);
            vC = mix(vC, vec3(1.1, 1.15, 1.2), uSnow);
            vC = mix(vC, plankton, glow);
            vC = mix(vC, mix(vec3(3.0, 0.8, 0.15), vec3(3.5, 2.0, 0.6), fract(aSeed * 13.0)) * (0.5 + 1.5 * pulse), ember);
            vA = mix(vA, edge, max(glow, ember));
            gl_PointSize = clamp((0.06 + aSeed * 0.08 + glow * 0.08 + uSnow * 0.05) * uPR * 900.0 / -mv.z, 1.0, 14.0);
          }`,
        fragmentShader: /* glsl */ `
          varying float vA; varying vec3 vC;
          void main(){ vec2 c = gl_PointCoord - 0.5; float d = exp(-dot(c, c) * 14.0); if (d * vA < 0.01) discard; gl_FragColor = vec4(vC * d * vA * 0.5, 1.0); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    m.frustumCulled = false;
    m.renderOrder = 6;
    return m;
  }

  setPixelRatio(pr) {
    if (this.snow) this.snow.material.uniforms.uPR.value = pr;
  }

  update(dt) {
    for (const c of this.clams) {
      c.timer -= dt;
      if (c.timer <= 0) {
        c.target = c.target ? 0 : 1;
        c.timer = c.target ? 3.2 : 6 + Math.random() * 6;
      }
      if (!c.hasPearl) {
        c.regrow -= dt;
        if (c.regrow <= 0) c.hasPearl = true;
      }
      c.open += ((c.target || 0) - c.open) * (1 - Math.exp(-dt * 4));
      c.upperPivot.rotation.x = -c.open * c.maxOpen;
      c.pearl.visible = c.hasPearl && c.open > 0.15;
    }
    // hot vents: idle -> rumble (a warning) -> erupt -> idle
    for (const h of this.hazards) {
      h.t -= dt;
      if (h.t <= 0) {
        if (h.state === 'idle') (h.state = 'warn'), (h.t = 1.5);
        else if (h.state === 'warn') (h.state = 'erupt'), (h.t = 2.6);
        else (h.state = 'idle'), (h.t = 5 + Math.random() * 5);
      }
      const want = h.state === 'erupt' ? 1 : h.state === 'warn' ? 0.12 + 0.08 * Math.sin(h.t * 30) : 0;
      h.k += (want - h.k) * (1 - Math.exp(-dt * (h.state === 'erupt' ? 6 : 3)));
      h.U.uK.value = h.k;
      h.cap.material.opacity = 0.6 + 0.4 * Math.min(1, h.k * 3);
    }
  }
}
