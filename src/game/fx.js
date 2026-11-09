import * as THREE from 'three';
import { G, COMMON, WORLD } from '../core/globals.js';

// CPU-simulated point particles: bubbles (alpha blended rings) and glints (additive).
class Pool {
  constructor(max, additive) {
    this.max = max;
    this.n = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.size = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.kind = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aKind = new THREE.BufferAttribute(this.kind, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setAttribute('aCol', this.aCol);
    g.setAttribute('aKind', this.aKind);
    this.uPR = { value: 1 };
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...G, uPR: this.uPR },
      vertexShader: COMMON + /* glsl */ `
        attribute float aSize; attribute float aAlpha; attribute vec3 aCol; attribute float aKind;
        uniform float uPR;
        varying float vA; varying vec3 vC; varying float vK; varying vec3 vWP;
        void main(){
          vec4 mv = viewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uPR * 900.0 / -mv.z, 1.0, 96.0);
          vA = aAlpha; vC = aCol; vK = aKind; vWP = position;
        }`,
      fragmentShader: COMMON + /* glsl */ `
        varying float vA; varying vec3 vC; varying float vK; varying vec3 vWP;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c) * 2.0;
          if (r > 1.0) discard;
          vec4 o;
          if (vK < 0.5) {
            // bubble: bright rim, clear middle, a highlight up and to the left
            float rim = smoothstep(0.62, 0.92, r) * (1.0 - smoothstep(0.92, 1.0, r));
            float hi = exp(-dot(c - vec2(-0.16, 0.16), c - vec2(-0.16, 0.16)) * 120.0);
            vec3 col = mix(uShallow, vec3(0.9, 1.0, 1.0), 0.6) + uSunCol * 0.3;
            o = vec4(col * (1.0 + hi * 2.0), (rim * 0.75 + hi + 0.05) * vA);
            o.rgb = applyWaterFog(o.rgb, vWP);
          } else if (vK < 1.5) {
            // glint: a soft star
            float g = exp(-r * r * 5.0) + 0.6 * exp(-abs(c.x) * 40.0) * exp(-abs(c.y) * 4.0) + 0.6 * exp(-abs(c.y) * 40.0) * exp(-abs(c.x) * 4.0);
            o = vec4(vC * g * vA, 1.0);
          } else {
            // a flake of scale or food
            float g = smoothstep(1.0, 0.6, r);
            o = vec4(applyWaterFog(vC, vWP), g * vA);
          }
          gl_FragColor = o;
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 9 : 8;
  }
  emit(x, y, z, vx, vy, vz, life, size, kind, col = [1, 1, 1]) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p.set([x, y, z], i * 3);
    this.v.set([vx, vy, vz], i * 3);
    this.col.set(col, i * 3);
    this.life[i] = life;
    this.age[i] = 0;
    this.size[i] = size;
    this.kind[i] = kind;
  }
  update(dt, t) {
    const sz = this.aSize.array, al = this.aAlpha.array;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i] || this.p[i * 3 + 1] > WORLD.SURFACE - 0.1) {
        // swap-remove
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) {
            this.p[i * 3 + k] = this.p[j * 3 + k];
            this.v[i * 3 + k] = this.v[j * 3 + k];
            this.col[i * 3 + k] = this.col[j * 3 + k];
          }
          this.life[i] = this.life[j];
          this.age[i] = this.age[j];
          this.size[i] = this.size[j];
          this.kind[i] = this.kind[j];
          i--;
        }
        continue;
      }
      const k = this.kind[i];
      const i3 = i * 3;
      if (k < 0.5) {
        // bubbles accelerate upward and wobble
        this.v[i3 + 1] += dt * 2.2;
        this.v[i3] *= 1 - dt * 1.5;
        this.v[i3 + 2] *= 1 - dt * 1.5;
        this.p[i3] += Math.sin(t * 6 + i) * dt * 0.25;
      } else if (k < 1.5) {
        this.v[i3] *= 1 - dt * 3;
        this.v[i3 + 1] *= 1 - dt * 3;
        this.v[i3 + 2] *= 1 - dt * 3;
      } else {
        this.v[i3] *= 1 - dt * 2;
        this.v[i3 + 1] = this.v[i3 + 1] * (1 - dt * 2) - dt * 0.6;
        this.v[i3 + 2] *= 1 - dt * 2;
      }
      this.p[i3] += this.v[i3] * dt;
      this.p[i3 + 1] += this.v[i3 + 1] * dt;
      this.p[i3 + 2] += this.v[i3 + 2] * dt;
      const a = this.age[i] / this.life[i];
      al[i] = k < 0.5 ? Math.min(1, a * 6) * (1 - Math.pow(a, 3)) : (1 - a) * Math.min(1, a * 10);
      sz[i] = this.size[i] * (k < 0.5 ? 0.6 + a * 0.5 : k < 1.5 ? 1 - a * 0.5 : 1);
    }
    this.points.geometry.setDrawRange(0, this.n);
    for (const a of [this.aPos, this.aSize, this.aAlpha, this.aCol, this.aKind]) a.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, camera) {
    this.camera = camera;
    this.bubbles = new Pool(1400, false);
    this.glints = new Pool(700, true);
    scene.add(this.bubbles.points, this.glints.points);
    this.popLayer = document.getElementById('popups');
    this.shake = 0;
    this.t = 0;
  }
  setPixelRatio(pr) {
    this.bubbles.uPR.value = pr;
    this.glints.uPR.value = pr;
  }
  bubble(x, y, z, n = 1, spread = 0.3, speed = 1, size = 0.12) {
    for (let i = 0; i < n; i++)
      this.bubbles.emit(
        x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, z + (Math.random() - 0.5) * spread * 0.5,
        (Math.random() - 0.5) * speed, Math.random() * speed * 0.5 + 0.3, (Math.random() - 0.5) * speed * 0.3,
        1.2 + Math.random() * 1.8, size * (0.5 + Math.random()), 0
      );
  }
  burst(x, y, size, col) {
    // a mouthful: bubbles, flakes in the prey's colour and a few glints
    const n = Math.round(8 + size * 8);
    this.bubble(x, y, 0.2, n, size * 0.5, 2.5 + size, 0.1 + size * 0.04);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (1 + Math.random() * 2.5) * (0.6 + size * 0.3);
      this.bubbles.emit(x, y, 0.3, Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5), 0.6 + Math.random() * 0.6, 0.06 + size * 0.03, 2, col);
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 3;
      this.glints.emit(x, y, 0.5, Math.cos(a) * s, Math.sin(a) * s, 0, 0.45 + Math.random() * 0.3, 0.25 + size * 0.06, 1, [2.2, 1.9, 1.2]);
    }
  }
  sparkle(x, y, z, n, col = [2.2, 2.1, 2.6], size = 0.35) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      this.glints.emit(x, y, z, Math.cos(a) * s, Math.sin(a) * s, 0, 0.6 + Math.random() * 0.6, size * (0.6 + Math.random() * 0.8), 1, col);
    }
  }
  popup(text, wx, wy, cls = '') {
    const v = new THREE.Vector3(wx, wy, 0).project(this.camera);
    if (Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
    const el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.textContent = text;
    el.style.left = ((v.x * 0.5 + 0.5) * 100).toFixed(2) + '%';
    el.style.top = ((-v.y * 0.5 + 0.5) * 100).toFixed(2) + '%';
    this.popLayer.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
  update(dt) {
    this.t += dt;
    this.bubbles.update(dt, this.t);
    this.glints.update(dt, this.t);
    this.shake = Math.max(0, this.shake - dt * 3);
  }
  clear() {
    this.bubbles.n = this.glints.n = 0;
    this.popLayer.innerHTML = '';
  }
}
