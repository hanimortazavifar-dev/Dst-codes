/**
 * Morphing particle shaders. Each particle blends p0→p1→…→p4 as uProgress goes 0→4, with a
 * burst of jitter mid-morph, a mouse push, and a slow 3-stop colour cycle. On the last stage
 * (the network map) particles flagged by aLineMask travel through their own colour cycle.
 */
export const vertexShader = /* glsl */ `
uniform float uProgress; uniform float uTime; uniform vec3 uMouse; uniform float uPR; uniform float uDim; uniform float uJitterAmp; uniform float uMobile;
uniform vec3 uColorA; uniform vec3 uColorB; uniform vec3 uColorC;
uniform vec3 uLineColorA; uniform vec3 uLineColorB; uniform vec3 uLineColorC;
attribute vec3 p0; attribute vec3 p1; attribute vec3 p2; attribute vec3 p3; attribute vec3 p4; attribute float aRand; attribute float aLineMask;
varying vec3 vColor; varying float vAlpha;
float ease(float t){ return t*t*(3.0-2.0*t); }
void main(){
  float s = clamp(uProgress, 0.0, 4.0);
  vec3 pos;
  if (s < 1.0) pos = mix(p0, p1, ease(s));
  else if (s < 2.0) pos = mix(p1, p2, ease(s-1.0));
  else if (s < 3.0) pos = mix(p2, p3, ease(s-2.0));
  else pos = mix(p3, p4, ease(s-3.0));
  float trans = sin(fract(s) * 3.14159);
  vec3 jit = normalize(vec3(sin(aRand*91.0), cos(aRand*57.0), sin(aRand*23.0)) + 0.001);
  pos += jit * trans * (0.3 + aRand * 0.7);
  pos += jit * 0.015 * uJitterAmp * sin(uTime * 2.0 + aRand * 40.0);
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vec2 d = world.xy - uMouse.xy;
  float dist = length(d);
  float force = smoothstep(0.255, 0.0, dist);
  world.xy += normalize(d + 0.0001) * force * 0.55;
  world.z += force * 0.4;
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;

  // Map connector lines (last stage) render thinner and fade in near the end of the scroll.
  float lineActive = aLineMask * smoothstep(3.3, 3.8, s);
  // Mobile: stage 1 renders 45% thinner and stages 2–4 40% thinner, fading back while morphing.
  float w1 = s < 1.0 ? (1.0 - ease(s)) : 0.0;
  float w2 = s < 1.0 ? ease(s) : (s < 2.0 ? (1.0 - ease(s - 1.0)) : 0.0);
  float w3 = s < 1.0 ? 0.0 : (s < 2.0 ? ease(s - 1.0) : (s < 3.0 ? (1.0 - ease(s - 2.0)) : 0.0));
  float w4 = s < 2.0 ? 0.0 : (s < 3.0 ? ease(s - 2.0) : (s < 4.0 ? (1.0 - ease(s - 3.0)) : 0.0));
  float thin = mix(1.0, 0.55, w1 * uMobile) * mix(1.0, 0.6, w2 * uMobile) * mix(1.0, 0.6, w3 * uMobile) * mix(1.0, 0.6, w4 * uMobile);
  gl_PointSize = (1.4 + aRand * 2.2) * uPR * (7.0 / -mv.z) * (1.0 + force) * (1.0 - lineActive * 0.2) * (1.0 - lineActive * 0.4) * thin;

  float t = fract(uTime * 0.06 + aRand * 0.25 + pos.y * 0.18 + s * 0.15) * 4.0;
  vec3 c = t < 1.0 ? mix(uColorA, uColorB, t) : (t < 2.0 ? mix(uColorB, uColorA, t-1.0) : (t < 3.0 ? mix(uColorA, uColorC, t-2.0) : mix(uColorC, uColorA, t-3.0)));
  if (lineActive > 0.0) {
    float lt = fract(uTime * 0.35 - length(pos.xy) * 0.9) * 3.0;
    vec3 lc = lt < 1.0 ? mix(uLineColorA, uLineColorB, lt) : (lt < 2.0 ? mix(uLineColorB, uLineColorC, lt-1.0) : mix(uLineColorC, uLineColorA, lt-2.0));
    c = mix(c, lc, lineActive);
  }
  vColor = mix(c, vec3(1.0), force * 0.5);
  vAlpha = (0.55 + aRand * 0.45) * uDim;
}`;

export const fragmentShader = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, a * vAlpha);
}`;
