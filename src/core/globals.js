import * as THREE from 'three';

// World layout: gameplay happens on the z = 0 plane.
export const WORLD = { W: 70, SURFACE: 14, FLOOR: -14 };

// Uniforms shared by every shader; the level theme writes them once.
export const G = {
  uTime: { value: 0 },
  uShallow: { value: new THREE.Vector3(0.1, 0.55, 0.65) },
  uDeep: { value: new THREE.Vector3(0.0, 0.08, 0.16) },
  uSunCol: { value: new THREE.Vector3(1.6, 1.5, 1.2) },
  uLightDir: { value: new THREE.Vector3(0.25, 1, 0.15).normalize() },
  uSurfaceY: { value: WORLD.SURFACE },
  uFloorY: { value: WORLD.FLOOR },
  uFogDen: { value: 0.03 },
  // fog only starts a little in front of the play plane, so the action stays crisp
  uFogStart: { value: 16 },
  uCaust: { value: 1 },
  uBio: { value: 0 },
  // per-sea extras: snow on top-facing surfaces, glowing lava below, an ice ceiling
  uSnow: { value: 0 },
  uLava: { value: 0 },
  uLavaCol: { value: new THREE.Vector3(3.2, 0.9, 0.18) },
  uIce: { value: 0 },
};

export const COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSunCol;
uniform vec3 uLightDir;
uniform float uSurfaceY;
uniform float uFloorY;
uniform float uFogDen;
uniform float uFogStart;
uniform float uCaust;
uniform float uBio;
uniform float uSnow;
uniform float uLava;
uniform vec3 uLavaCol;
uniform float uIce;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
// distance to the nearest and second-nearest cell point (cracks live where they meet)
vec2 cellular(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++){
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash12(i + g), hash12(i + g + 19.7));
      float d = length(g + o - f);
      if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
  return vec2(d1, d2);
}
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }

// how deep a point sits, 0 at the surface, 1 at the sea floor
float depth01(float y){ return clamp((uSurfaceY - y) / (uSurfaceY - uFloorY), 0.0, 1.2); }

// colour of the water itself along a view ray: bright towards the surface, dark below
vec3 waterCol(float y, vec3 rd){
  float d = depth01(y);
  vec3 c = mix(uShallow, uDeep, smoothstep(-0.25, 1.25, d));
  c *= 0.75 + 0.5 * smoothstep(-0.6, 0.8, rd.y);
  c += uSunCol * 0.05 * pow(max(rd.y, 0.0), 3.0) * (1.0 - uBio);
  // a red haze rises off the lava fields
  c += uLavaCol * uLava * 0.05 * smoothstep(0.5, 1.15, d) * (0.6 + 0.4 * smoothstep(0.2, -0.6, rd.y));
  return c;
}

// absorption and scattering: reds die first, everything sinks into the water colour
vec3 applyWaterFog(vec3 col, vec3 wp){
  vec3 d = wp - cameraPosition;
  float len = length(d);
  vec3 rd = d / max(len, 1e-4);
  float dist = max(len - uFogStart, 0.0) + len * 0.12;
  vec3 absorb = exp(-dist * uFogDen * vec3(1.15, 0.6, 0.45));
  col *= absorb;
  float f = 1.0 - exp(-dist * uFogDen * 1.15);
  return mix(col, waterCol(wp.y, rd), f);
}

// tileable caustic pattern (after joltz0r's "tileable water caustic")
float caustic(vec2 uv, float t){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++){
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}
// glow from the lava below: lights undersides near the floor, flickering
vec3 lavaLight(vec3 wp, vec3 n){
  if (uLava <= 0.0) return vec3(0.0);
  float h = max(wp.y - uFloorY, 0.0);
  float flick = 0.8 + 0.2 * sin(uTime * 1.7 + wp.x * 0.3) * sin(uTime * 2.9 + wp.x * 0.11);
  return uLavaCol * uLava * exp(-h * 0.15) * (0.3 + 0.7 * clamp(-n.y * 0.5 + 0.5, 0.0, 1.0)) * flick * 0.35;
}

// caustic light falling on a surface at world position wp with normal n
float causticLight(vec3 wp, vec3 n){
  vec2 uv = (wp.xz + wp.y * vec2(0.25, 0.15)) * 0.085;
  float c = caustic(uv, uTime * 0.45) * 0.7 + caustic(uv * 1.7 + 0.3, uTime * 0.6) * 0.3;
  float fall = (1.0 - smoothstep(0.0, 1.05, depth01(wp.y))) * uCaust;
  return c * fall * smoothstep(-0.2, 0.8, n.y);
}
`;
