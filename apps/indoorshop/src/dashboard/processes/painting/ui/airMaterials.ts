import * as THREE from 'three'

/*
 * 기류의 **재질** — 움직임은 전부 여기 셰이더가 시간(`uTime`)으로 만든다 (R44).
 *
 * 예전에는 프레임마다 CPU 가 파티클 좌표를 다시 써서 GPU 에 올렸다. 개수가 예산에 묶인
 * 이유의 절반이 그것이었다(정점 수 = 매 프레임 JS 루프). 이제 정점은 원점·방향·난수만
 * 갖고 위치는 정점 셰이더가 시간으로 계산한다 — 개수가 늘어도 CPU 는 uniform 하나만
 * 바꾼다. 세기는 정점 속성이라 폴링 때만 다시 쓴다.
 *
 * 네 재질 모두 **가산 혼합·깊이 쓰기 없음** — 공기는 물체를 가리지 않고 밝힌다.
 */

const TIMED = new Set<THREE.ShaderMaterial>()

/** 시간을 받는 재질 전부에 한 번에 — 프레임마다 재질을 찾아다니지 않게 */
export function tickAirMaterials(seconds: number): void {
  for (const material of TIMED) material.uniforms.uTime.value = seconds
}

function timed<T extends THREE.ShaderMaterial>(material: T): T {
  TIMED.add(material)
  const dispose = material.dispose.bind(material)
  material.dispose = () => {
    TIMED.delete(material)
    dispose()
  }
  return material
}

/* ── 유선 리본 ─────────────────────────────────────────────── */

const RIBBON_VERTEX = /* glsl */ `
  attribute float aT;
  attribute float aEdge;
  attribute float aSeed;
  attribute float aIntensity;
  uniform float uTime;
  varying float vT;
  varying float vEdge;
  varying float vSeed;
  varying float vI;
  void main() {
    vT = aT;
    vEdge = aEdge;
    vSeed = aSeed;
    vI = aIntensity;
    vec3 p = position;
    /* 띠가 아주 조금 일렁인다 — 고정된 띠는 배관처럼 읽힌다 */
    p.y += sin(uTime * 0.8 + aSeed * 6.2831 + aT * 4.0) * 0.35 * aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const RIBBON_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform vec2 uFade;
  varying float vT;
  varying float vEdge;
  varying float vSeed;
  varying float vI;
  void main() {
    if (vI <= 0.001) discard;
    float speed = 0.35 + 0.9 * vI;
    /* 띠를 따라 흘러가는 꼬리 — 앞이 밝고 뒤로 잦아드는 혜성 모양 */
    float band = fract(vT * 5.0 - uTime * speed + vSeed);
    float pulse = pow(smoothstep(0.0, 0.3, band) * (1.0 - smoothstep(0.3, 1.0, band)), 1.4);
    float edge = 1.0 - vEdge * vEdge;
    float ends = smoothstep(0.0, uFade.x, vT) * (1.0 - smoothstep(uFade.y, 1.0, vT));
    float a = (0.08 + 0.5 * pulse) * edge * ends * (0.3 + 0.7 * vI);
    gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.3 * pulse), a);
  }
`

export function ribbonMaterial(color: THREE.Color, fade: [number, number]): THREE.ShaderMaterial {
  return timed(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: color.clone() },
        uFade: { value: new THREE.Vector2(fade[0], fade[1]) },
      },
      vertexShader: RIBBON_VERTEX,
      fragmentShader: RIBBON_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  )
}

/* ── 입자 ──────────────────────────────────────────────────── */

const PARTICLE_VERTEX = /* glsl */ `
  attribute vec3 aOrigin;
  attribute vec3 aDir;
  attribute vec4 aRand;
  attribute float aOn;
  attribute float aIntensity;
  uniform float uTime;
  uniform float uMode;
  uniform float uPixelRatio;
  uniform float uRise;
  varying float vAlpha;
  void main() {
    if (aOn < 0.5 || aIntensity <= 0.001) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }
    float speed = (0.08 + 0.16 * aIntensity) * (0.7 + 0.6 * aRand.w);
    float life = fract(aRand.x + uTime * speed);
    float reach = length(aDir.xz);
    vec3 fwd = vec3(aDir.x, 0.0, aDir.z) / max(reach, 0.001);
    vec3 side = vec3(-fwd.z, 0.0, fwd.x);
    vec3 p;
    float size;
    if (uMode < 0.5) {
      /* 히터 — 토출구에서 앞으로 퍼지며 떠오른다 */
      float d = life * reach;
      float spread = (aRand.y - 0.5) * 2.0;
      p = aOrigin + fwd * d + side * spread * d * 0.45;
      p.y += pow(life, 1.6) * uRise + sin(uTime * 1.1 + aRand.z * 6.2831) * 0.5 * life;
      size = 1.4 + 5.0 * life;
    } else {
      /* 제습기 — 베이 안쪽에서 흡입구로 빨려든다. 가까울수록 빨라지고 작아진다 */
      float ang = (aRand.y - 0.5) * 2.4;
      vec3 dir = fwd * cos(ang) + side * sin(ang);
      vec3 start = aOrigin + dir * reach * (0.45 + 0.55 * aRand.z);
      start.y = 0.8 + aRand.w * 6.0;
      float e = life * life;
      p = mix(start, aOrigin, e);
      p += side * sin(uTime * 1.4 + aRand.x * 6.2831) * 0.6 * (1.0 - life);
      size = 3.4 - 2.4 * life;
    }
    vAlpha = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.6, 1.0, life)) * (0.35 + 0.65 * aIntensity);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = size * uPixelRatio * (260.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`

const PARTICLE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float soft = 1.0 - smoothstep(0.15, 1.0, d);
    float core = 1.0 - smoothstep(0.0, 0.35, d);
    vec3 col = mix(uColor, vec3(1.0), core * 0.6);
    gl_FragColor = vec4(col, vAlpha * soft * 0.8);
  }
`

export function particleMaterial(
  color: THREE.Color,
  mode: 'heat' | 'dry',
  pixelRatio: number,
  riseM: number
): THREE.ShaderMaterial {
  return timed(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: color.clone() },
        uMode: { value: mode === 'heat' ? 0 : 1 },
        uPixelRatio: { value: pixelRatio },
        uRise: { value: riseM },
      },
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
}

/* ── 바닥장 ────────────────────────────────────────────────── */

const FIELD_VERTEX = /* glsl */ `
  attribute float aIntensity;
  attribute float aMode;
  varying vec2 vUv;
  varying float vI;
  varying float vMode;
  varying vec3 vTint;
  void main() {
    vUv = uv;
    vI = aIntensity;
    vMode = aMode;
    #ifdef USE_INSTANCING_COLOR
      vTint = instanceColor;
    #else
      vTint = vec3(1.0);
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const FIELD_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vI;
  varying float vMode;
  varying vec3 vTint;
  void main() {
    if (vI <= 0.001) discard;
    float u = vUv.y;                 /* 0 = 설비, 1 = 닿는 끝 */
    float v = (vUv.x - 0.5) * 2.0;   /* -1 ~ 1 좌우 */
    float r = length(vec2(v * 0.7, u));
    /* 부채꼴 — 설비에서 멀어질수록 좌우로 넓어진다 */
    float fan = 1.0 - smoothstep(0.75, 1.0, abs(v) / (u * 0.9 + 0.12));
    /* 파문 — 히터는 밖으로(+), 제습기는 안으로(-) 흐른다 */
    float dir = vMode < 0.5 ? 1.0 : -1.0;
    float phase = fract(r * 4.5 - uTime * dir * (0.25 + 0.55 * vI));
    float ring = pow(max(0.0, 1.0 - abs(phase - 0.5) * 2.0), 3.0);
    float falloff = 1.0 - smoothstep(0.5, 1.0, r);
    float a = (0.05 + 0.32 * ring) * fan * falloff * (0.35 + 0.65 * vI);
    gl_FragColor = vec4(mix(vTint, vec3(1.0), 0.15 * ring), a);
  }
`

export function floorFieldMaterial(): THREE.ShaderMaterial {
  return timed(
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: FIELD_VERTEX,
      fragmentShader: FIELD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
}

/* ── 베이 헤이즈 ──────────────────────────────────────────── */

const HAZE_VERTEX = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const HAZE_FRAGMENT = /* glsl */ `
  uniform vec3 uHeatColor;
  uniform vec3 uDryColor;
  uniform float uHeat;
  uniform float uDry;
  uniform float uTime;
  uniform vec3 uHalf;
  varying vec3 vPos;
  void main() {
    float sum = uHeat + uDry;
    if (sum <= 0.001) discard;
    vec3 n = vPos / uHalf;
    float yy = (n.y + 1.0) * 0.5;
    /* 바닥에 깔리고 위로 옅어진다 — 더운 공기도 마른 공기도 사람 키 높이에서 일한다 */
    float vert = 1.0 - smoothstep(0.05, 1.0, yy);
    float edge = 1.0 - pow(max(abs(n.x), abs(n.z)), 6.0);
    float drift = 0.85 + 0.15 * sin(uTime * 0.4 + n.x * 2.0 + n.z * 1.5);
    float a = (uHeat * 0.16 + uDry * 0.11) * vert * edge * drift;
    vec3 col = (uHeatColor * uHeat + uDryColor * uDry) / sum;
    gl_FragColor = vec4(col, a);
  }
`

export function hazeMaterial(
  heatColor: THREE.Color,
  dryColor: THREE.Color,
  half: [number, number, number]
): THREE.ShaderMaterial {
  return timed(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHeatColor: { value: heatColor.clone() },
        uDryColor: { value: dryColor.clone() },
        uHeat: { value: 0 },
        uDry: { value: 0 },
        uHalf: { value: new THREE.Vector3(half[0], half[1], half[2]) },
      },
      vertexShader: HAZE_VERTEX,
      fragmentShader: HAZE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
    })
  )
}
