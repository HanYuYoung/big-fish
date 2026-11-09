import * as THREE from 'three';
import { G } from '../core/globals.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const fsMat = (frag, uniforms = {}) =>
  new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false });

const rt = (w, h) =>
  new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh;
varying vec2 vUv;
vec3 S(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main(){
  vec3 c = S(vec2(0)) * 0.125;
  c += (S(vec2(-1,-1)) + S(vec2(1,-1)) + S(vec2(-1,1)) + S(vec2(1,1))) * 0.125;
  c += (S(vec2(-2,0)) + S(vec2(2,0)) + S(vec2(0,-2)) + S(vec2(0,2))) * 0.0625;
  c += (S(vec2(-2,-2)) + S(vec2(2,-2)) + S(vec2(-2,2)) + S(vec2(2,2))) * 0.03125;
  if (uThresh > 0.0) {
    c = min(c, vec3(40.0));
    float l = max(c.r, max(c.g, c.b));
    float k = max(l - uThresh, 0.0);
    c *= (k * k / (k + 0.4 + 1e-4)) / max(l, 1e-4);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

// HDR scene -> bloom -> underwater grade, filmic tone map -> screen
export class Pipeline {
  constructor(renderer, scene, camera) {
    this.r = renderer;
    this.scene = scene;
    this.camera = camera;
    this.params = { exposure: 1, bloom: 0.07, fade: 1, hurt: 0, flash: 0, ca: 0, vignette: 0.42 };
    this.qscene = new THREE.Scene();
    this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(tri, null);
    this.quad.frustumCulled = false;
    this.qscene.add(this.quad);
    this.mDown = fsMat(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 0 } });
    this.mUp = fsMat(
      /* glsl */ `
      uniform sampler2D tSrc; uniform sampler2D tLow; uniform vec2 uTexel;
      varying vec2 vUv;
      vec3 L(vec2 o){ return texture2D(tLow, vUv + o * uTexel).rgb; }
      void main(){
        vec3 b = L(vec2(0)) * 4.0 + (L(vec2(-1,0)) + L(vec2(1,0)) + L(vec2(0,-1)) + L(vec2(0,1))) * 2.0 + L(vec2(-1,-1)) + L(vec2(1,-1)) + L(vec2(-1,1)) + L(vec2(1,1));
        gl_FragColor = vec4(texture2D(tSrc, vUv).rgb + b / 16.0 * 0.85, 1.0);
      }`,
      { tSrc: { value: null }, tLow: { value: null }, uTexel: { value: new THREE.Vector2() } }
    );
    this.mComp = fsMat(
      /* glsl */ `
      uniform sampler2D tScene; uniform sampler2D tBloom;
      uniform float uExposure, uBloom, uFade, uHurt, uFlash, uCA, uVig, uTime;
      uniform vec2 uRes;
      varying vec2 vUv;
      vec3 RRT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c){
        const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
        const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
        return clamp(O * RRT(I * c), 0.0, 1.0);
      }
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        // the faint wobble of looking through water
        vec2 uv = vUv + vec2(sin(vUv.y * 24.0 + uTime * 1.3), cos(vUv.x * 19.0 + uTime * 1.1)) * 0.0009;
        vec2 cc = uv - 0.5;
        float e2 = dot(cc, cc);
        vec2 ca = cc * e2 * (0.012 + uCA * 0.03);
        vec3 col = vec3(texture2D(tScene, uv - ca).r, texture2D(tScene, uv).g, texture2D(tScene, uv + ca).b);
        col += texture2D(tBloom, uv).rgb * uBloom;
        col *= uExposure;
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(col, vec3(l) * vec3(1.4, 0.5, 0.5), uHurt * 0.55);
        col = aces(col);
        col *= 1.0 - uVig * smoothstep(0.12, 0.9, e2 * 2.2);
        col = mix(col, vec3(1.0, 0.97, 0.88), uFlash * 0.6);
        col *= uFade;
        col = toSRGB(col);
        float n = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 91.0, vec2(12.9898, 78.233))) * 43758.5453);
        gl_FragColor = vec4(col + (n - 0.5) * (2.0 / 255.0), 1.0);
      }`,
      {
        tScene: { value: null }, tBloom: { value: null }, uExposure: { value: 1 }, uBloom: { value: 0.07 }, uFade: { value: 1 },
        uHurt: { value: 0 }, uFlash: { value: 0 }, uCA: { value: 0 }, uVig: { value: 0.4 }, uTime: G.uTime, uRes: { value: new THREE.Vector2() },
      }
    );
    this.W = this.H = 0;
  }

  setSize(w, h) {
    if (w === this.W && h === this.H) return;
    this.W = w;
    this.H = h;
    [this.rtScene, ...(this.mips || []), ...(this.ups || [])].forEach((x) => x && x.dispose());
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.mips = [];
    this.ups = [];
    let mw = w >> 1, mh = h >> 1;
    for (let i = 0; i < 6; i++) {
      this.mips.push(rt(mw, mh));
      this.ups.push(rt(mw, mh));
      mw = Math.max(2, mw >> 1);
      mh = Math.max(2, mh >> 1);
    }
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.qscene, this.qcam);
  }

  render() {
    const r = this.r, p = this.params;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, this.camera);
    let src = this.rtScene;
    for (let i = 0; i < this.mips.length; i++) {
      this.mDown.uniforms.tSrc.value = src.texture;
      this.mDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.mDown.uniforms.uThresh.value = i === 0 ? 0.85 : 0;
      this.pass(this.mDown, this.mips[i]);
      src = this.mips[i];
    }
    let low = this.mips[this.mips.length - 1];
    for (let i = this.mips.length - 2; i >= 0; i--) {
      this.mUp.uniforms.tSrc.value = this.mips[i].texture;
      this.mUp.uniforms.tLow.value = low.texture;
      this.mUp.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      this.pass(this.mUp, this.ups[i]);
      low = this.ups[i];
    }
    const u = this.mComp.uniforms;
    u.tScene.value = this.rtScene.texture;
    u.tBloom.value = this.ups[0].texture;
    u.uExposure.value = p.exposure;
    u.uBloom.value = p.bloom;
    u.uFade.value = p.fade;
    u.uHurt.value = p.hurt;
    u.uFlash.value = p.flash;
    u.uCA.value = p.ca;
    u.uVig.value = p.vignette;
    this.pass(this.mComp, null);
  }
}
