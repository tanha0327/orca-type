/* =========================================================
   GLSL。座標はすべて画面 px（y 下向き）で考える。
   FX は加算合成なので、アルファではなく色の強さで透明度を表す。
   ========================================================= */

export const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
vec3 hue(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}
`

export const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/* ---------- 背景：カメラ映像をモノクロ化し、FX の光で照らす ---------- */
export const BG_FRAG = /* glsl */ `
uniform sampler2D uVideo;
uniform float uHasVideo;
uniform vec2 uRes;
uniform vec2 uVidRes;
uniform float uPad;
uniform float uTime;
uniform float uFlash;
uniform vec4 uWave[6];
uniform float uWaveW[6];
uniform int uNW;
uniform vec4 uLA[8];
uniform vec4 uLB[8];
uniform float uLR[8];
uniform int uNL;
varying vec2 vUv;

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-3), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 px = vUv * (uRes + 2.0 * uPad) - uPad;

  // 衝撃波で映像を歪める
  vec2 off = vec2(0.0);
  for (int i = 0; i < 6; i++) {
    if (i >= uNW) break;
    vec2 d = px - uWave[i].xy;
    float dist = length(d) + 1e-3;
    float k = (dist - uWave[i].z) / uWaveW[i];
    off += d / dist * exp(-k * k) * uWave[i].w;
  }
  vec2 sp = px - off;

  vec3 base;
  if (uHasVideo > 0.5) {
    float s = max(uRes.x / uVidRes.x, uRes.y / uVidRes.y);
    vec2 vp = (sp - (uRes - uVidRes * s) * 0.5) / s;
    vec2 uv = vp / uVidRes;
    uv = vec2(1.0 - uv.x, 1.0 - uv.y);
    vec3 c = texture2D(uVideo, clamp(uv, 0.001, 0.999)).rgb;
    float g = dot(c, vec3(0.2126, 0.7152, 0.0722));
    g = smoothstep(0.012, 0.8, g);
    base = vec3(g * 0.34);
  } else {
    vec2 gp = abs(fract(sp / 56.0) - 0.5);
    float line = smoothstep(0.475, 0.5, max(gp.x, gp.y));
    vec2 gq = abs(fract(sp / 280.0) - 0.5);
    float major = smoothstep(0.494, 0.5, max(gq.x, gq.y));
    float vig = 1.0 - length(vUv - 0.5) * 1.1;
    base = vec3(0.01 + line * 0.022 + major * 0.05) * max(vig, 0.2);
  }

  base *= 0.9 + 0.1 * sin(px.y * 1.6);

  vec3 light = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uNL) break;
    float d = segDist(px, uLA[i].xy, uLA[i].zw);
    light += uLB[i].rgb * uLB[i].w * exp(-d / uLR[i]);
  }
  vec3 lit = min(base * (1.0 + light * 2.4), vec3(0.62));
  vec3 col = lit + light * 0.02 + vec3(uFlash);
  gl_FragColor = vec4(col, 1.0);
}
`

/* ---------- ビーム本体。x=発射口からの距離, y=芯からの距離 ---------- */
export const BEAM_FRAG = /* glsl */ `
uniform float uTime;
uniform float uTotal;
uniform float uPad;
uniform float uHalfH;
uniform float uHead;
uniform float uCore;
uniform float uAlpha;
uniform float uSeed;
uniform float uKi;
uniform float uPrism;
uniform vec3 uOuter;
uniform vec3 uInner;
varying vec2 vUv;

void main() {
  float x = vUv.x * uTotal - uPad;
  float y = (vUv.y - 0.5) * 2.0 * uHalfH;
  float t = uTime;

  float n1 = fbm(vec2(x * 0.010 - t * 7.0, y * 0.035 + uSeed));
  float n2 = vnoise(vec2(x * 0.03 - t * 22.0, uSeed));
  float wob = 0.86 + 0.14 * sin(x * 0.045 - t * 38.0) + 0.14 * (n2 - 0.5);
  float cw = uCore * wob;

  if (uPrism > 0.5) {
    float tt = floor(t * 24.0);
    float band = floor(y / (cw * 0.3));
    float on = step(0.78, hash12(vec2(band * 1.7, tt)));
    y += (hash12(vec2(band, tt)) - 0.5) * cw * 0.6 * on;
  }

  float dx = max(0.0, -x) + max(0.0, x - uHead);
  float d = length(vec2(dx, y));

  float core = 1.0 - smoothstep(cw * 0.26, cw * 0.4, d);
  float inner = exp(-d / (cw * 0.4));
  float outer = exp(-d / (cw * 0.95)) * (0.45 + 0.8 * n1);
  float streak = smoothstep(0.6, 0.95, fbm(vec2(x * 0.0035 - t * 10.0, y / cw * 1.2 + uSeed))) * exp(-d / (cw * 0.6));

  vec3 oc = uOuter;
  vec3 ic = uInner;
  if (uPrism > 0.5) {
    oc = hue(y / (cw * 1.6) + x * 0.0008 - t * 0.8);
    ic = mix(vec3(1.0), hue(y / (cw * 1.0) - t * 1.3), 0.55);
  }

  vec3 col = oc * outer * 0.85 + ic * inner * 0.75 + vec3(1.0) * core * 2.0 + ic * streak * 0.8;

  if (uKi > 0.5) {
    float s = sin(x * 0.018 - t * 16.0) * cw * 1.1;
    float helix = exp(-abs(y - s) / (cw * 0.07)) + exp(-abs(y + s) / (cw * 0.07));
    col += ic * helix * 0.9 * step(0.0, x) * step(x, uHead);
    float hb = length(vec2(x - uHead, y));
    col += (ic + vec3(0.4)) * exp(-hb / (cw * 0.9)) * 1.1;
  }

  gl_FragColor = vec4(col * uAlpha, 1.0);
}
`

/* ---------- 溜め玉・発射口 ---------- */
export const ORB_FRAG = /* glsl */ `
uniform float uTime;
uniform float uHalf;
uniform float uR;
uniform float uInt;
uniform float uRays;
uniform float uSeed;
uniform float uPrism;
uniform float uUnstable;
uniform vec3 uOuter;
uniform vec3 uInner;
varying vec2 vUv;

void main() {
  vec2 p = (vUv - 0.5) * 2.0 * uHalf;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec2 dv = p / max(r, 1e-3);
  float t = uTime;

  float n = fbm(dv * 2.5 + vec2(uSeed, -t * 1.7) + r * 0.01);
  float n2 = fbm(dv * 5.0 - vec2(t * 2.3, uSeed));
  float R = uR * (1.0 + 0.1 * (n - 0.5) + uUnstable * 0.3 * (n2 - 0.5));

  float core = 1.0 - smoothstep(R * 0.4, R * 0.56, r);
  float body = exp(-max(r - R * 0.38, 0.0) / (R * 0.2));
  float corona = exp(-max(r - R * 0.7, 0.0) / (R * (0.26 + 0.24 * n)));
  float swirl = pow(max(0.0, sin(a * 3.0 + r * 0.06 - t * 9.0 + n * 3.0)), 10.0) * exp(-abs(r - R * 1.0) / (R * 0.22));

  float rays = 0.0;
  if (uRays > 0.0) {
    float star = pow(max(0.0, cos(a * 4.0 + t * 0.7)), 60.0) + pow(max(0.0, cos(a * 3.0 - t * 1.1 + 1.0)), 90.0);
    rays = uRays * star * exp(-r / (uHalf * 0.3));
    rays += uRays * exp(-abs(p.y) / max(R * 0.05, 1.0)) * exp(-abs(p.x) / (uHalf * 0.4));
  }

  vec3 oc = uOuter;
  if (uPrism > 0.5) oc = hue(a / 6.2831 + t * 0.6 + r * 0.004) * 1.4;

  vec3 col = oc * corona * 0.9 + uInner * body * 1.1 + vec3(1.0) * core * 1.6
           + uInner * swirl * 1.0 + mix(uInner, vec3(1.0), 0.5) * rays * 0.8;
  float edge = 1.0 - smoothstep(uHalf * 0.78, uHalf, r);
  gl_FragColor = vec4(col * uInt * edge, 1.0);
}
`

/* ---------- 衝撃波・リング（楕円はメッシュ側の拡縮で作る） ---------- */
export const RING_FRAG = /* glsl */ `
uniform float uR;
uniform float uW;
uniform float uAlpha;
uniform vec3 uCol;
varying vec2 vUv;
void main() {
  float r = length((vUv - 0.5) * 2.0);
  float k = (r - uR) / uW;
  float ring = exp(-k * k);
  float fill = step(r, uR) * exp(-(uR - r) / (uW * 2.5)) * 0.18;
  vec3 c = uCol * (ring * 1.0 + fill) + vec3(1.0) * pow(ring, 8.0) * 0.8;
  float edge = 1.0 - smoothstep(0.92, 1.0, r);
  gl_FragColor = vec4(c * uAlpha * edge, 1.0);
}
`

/* ---------- 帯（稲妻・斬撃・アーク）。vUv.x=長さ方向, vUv.y=幅方向 ---------- */
export const RIBBON_FRAG = /* glsl */ `
uniform vec3 uCol;
uniform float uAlpha;
uniform float uReveal;
uniform float uTail;
uniform float uCoreK;
varying vec2 vUv;
void main() {
  float d = abs(vUv.y * 2.0 - 1.0);
  float along = vUv.x;
  float vis = smoothstep(uTail, uTail + 0.04, along) * (1.0 - smoothstep(uReveal - 0.04, uReveal, along));
  float core = 1.0 - smoothstep(0.08, 0.26, d);
  float glow = exp(-d * 3.2) * (1.0 - d);
  vec3 c = uCol * glow * 1.1 + vec3(1.0) * core * uCoreK * 0.7;
  gl_FragColor = vec4(c * uAlpha * vis, 1.0);
}
`

/* ---------- 正面（カメラ方向）への照射：放射状のワープ ---------- */
export const FRONT_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform float uPad;
uniform vec2 uC;
uniform float uTime;
uniform float uR;
uniform float uAlpha;
uniform float uPrism;
uniform float uSeed;
uniform vec3 uOuter;
uniform vec3 uInner;
varying vec2 vUv;

void main() {
  vec2 px = vUv * (uRes + 2.0 * uPad) - uPad;
  vec2 p = px - uC;
  float r = length(p);
  vec2 dv = p / max(r, 1e-3);
  float a = atan(p.y, p.x);
  float t = uTime;
  float z = log(r + 20.0);

  float slots = 140.0;
  float fa = (a / 6.2831853 + 0.5) * slots;
  float rayId = floor(fa);
  float rh = hash12(vec2(rayId, uSeed));
  float streak = smoothstep(0.5, 1.0, vnoise(vec2(rayId * 1.7, z * 3.0 - t * (5.0 + rh * 7.0))));
  float thin = exp(-abs(fract(fa) - 0.5) * 7.0);
  float streaks = streak * thin * (0.35 + rh);

  float n = fbm(dv * 3.0 + vec2(-t * 2.0 + z, uSeed));
  float R = uR * (0.88 + 0.24 * n);
  float core = 1.0 - smoothstep(R * 0.7, R, r);
  float halo = exp(-max(r - R * 0.7, 0.0) / (R * 0.55));
  float fog = exp(-r / (uR * 3.0 + 160.0));

  vec3 oc = uOuter;
  if (uPrism > 0.5) oc = hue(a / 6.2831 + z * 0.5 - t);
  vec3 col = vec3(1.0) * core * 1.8 + uInner * halo * 1.0 + oc * fog * 0.35
           + mix(uInner, oc, 0.5) * streaks * (0.4 + 1.2 * fog) * 0.9;
  gl_FragColor = vec4(col * uAlpha, 1.0);
}
`

/* ---------- 火花：速度方向に伸びる光の粒 ---------- */
export const PARTICLE_VERT = /* glsl */ `
attribute vec2 iPos;
attribute vec2 iVel;
attribute vec4 iCol;
attribute vec2 iSize;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  float sp = length(iVel);
  vec2 dir = sp > 0.001 ? iVel / sp : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 p = iPos + dir * position.x * iSize.y + nrm * position.y * iSize.x;
  vUv = uv;
  vCol = iCol;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 0.0, 1.0);
}
`

export const PARTICLE_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec4 vCol;
void main() {
  float d = length((vUv - 0.5) * 2.0);
  float a = max(0.0, 1.0 - d);
  a *= a;
  gl_FragColor = vec4(vCol.rgb * vCol.a * (a + a * a * a * 2.0), 1.0);
}
`

/* ---------- 仕上げ：色収差・グリッチ・ノイズ・反転 ---------- */
export const POST_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uAberr;
uniform float uInvert;
uniform float uGlitch;
uniform float uTime;
uniform vec2 uRes;
varying vec2 vUv;

float h12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = vUv;
  if (uGlitch > 0.001) {
    float tt = floor(uTime * 30.0);
    float band = floor(uv.y * 42.0);
    if (h12(vec2(band, tt)) < uGlitch * 0.3) uv.x += (h12(vec2(tt, band)) - 0.5) * 0.09 * uGlitch;
  }
  vec2 c = uv - 0.5;
  float ab = 0.0012 + uAberr * 0.014;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + c * ab).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - c * ab).b;
  col *= 1.0 - dot(c, c) * 0.8;
  col += (h12(uv * uRes + fract(uTime * 7.0) * 311.0) - 0.5) * 0.04;
  col = mix(col, vec3(1.0) - col, clamp(uInvert, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`
