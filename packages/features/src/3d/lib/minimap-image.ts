/**
 * 미니맵 탑뷰 스냅샷의 픽셀 후처리 — Float 렌더 타깃 readback(선형 RGBA)을
 * 화면용 sRGB 이미지로 만든다. 적용은 ui/scene-minimap-capture.tsx.
 *
 * 왜 여기서 톤매핑을 하는가: three(r183)는 렌더 타깃에 그릴 때 톤매핑·출력
 * 색공간 변환을 건너뛴다(WebGLPrograms.getParameters — `currentRenderTarget
 * === null` 일 때만 renderer.toneMapping). 그래서 readback 값은 선형·비톤매핑
 * 이라 화면보다 어둡고 하이라이트가 뭉개진다. 화면과 같은 룩(ACESFilmic →
 * sRGB)을 JS 로 한 번 적용한다. 512² 이하 이미지를 한 번 처리하는 비용이라
 * 셰이더 패스를 따로 두지 않는다.
 *
 * 톤매핑은 three 의 `ACESFilmicToneMapping`(ShaderChunk
 * tonemapping_pars_fragment)을 그대로 옮긴 것이다 — 근사식(Narkowicz)은
 * 같은 곡선군이어도 중간 회색이 한 단계 밝게 나와 3D 화면과 색이 어긋난다.
 * 행렬이 채널을 섞으므로 채널별 룩업 테이블로 접을 수 없다. 노출은 렌더러와
 * 같은 1 이고 노출 보정은 없다 — 캡처가 기준 조명(lib/minimap-capture-
 * lighting)으로 찍히므로 입력 밝기가 시각과 무관하게 일정하다.
 *
 * 입력이 Float 인 이유: 8bit 선형 RT 는 어두운 값(지도의 그림자 면·바다)이
 * 몇 단계로 양자화돼 sRGB 로 펴면 띠·색 편향이 생긴다.
 */

export type RgbTriplet = [number, number, number];

/**
 * 입력 상한 — 이 위는 곡선이 이미 1 에 붙어 있고, 무한대를 그대로 넣으면
 * 유리식이 NaN 이 된다. float16 최대값.
 */
const TONE_MAP_INPUT_MAX = 65504;

/** three 의 렌더러 노출(SCENE_GL_OPTIONS.toneMappingExposure)과 같은 값. */
const TONE_MAP_EXPOSURE = 1;

function rrtAndOdtFit(v: number): number {
  const a = v * (v + 0.0245786) - 0.000090537;
  const b = v * (0.983729 * v + 0.432951) + 0.238081;
  return a / b;
}

function saturate(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** 음수·NaN 은 0, 무한대는 상한으로. */
function sanitizeInput(x: number): number {
  if (!(x > 0)) return 0;
  return x > TONE_MAP_INPUT_MAX ? TONE_MAP_INPUT_MAX : x;
}

/**
 * three r183 `ACESFilmicToneMapping` 의 픽셀 단위 이식 — 노출 1/0.6 →
 * ACESInputMat → RRT+ODT 유리식 → ACESOutputMat → [0,1] 클램프. GLSL mat3 은
 * 열 우선이라 세 vec3 가 열이고, 아래는 그것을 행 곱으로 풀어 쓴 것이다.
 * 입력·출력 선형. `out` 을 주면 그 튜플에 쓰고 돌려준다(픽셀 루프의 할당
 * 회피).
 */
export function acesFilmicToneMap(
  r: number,
  g: number,
  b: number,
  out: RgbTriplet = [0, 0, 0],
): RgbTriplet {
  const scale = TONE_MAP_EXPOSURE / 0.6;
  const ir = sanitizeInput(r) * scale;
  const ig = sanitizeInput(g) * scale;
  const ib = sanitizeInput(b) * scale;

  // ACESInputMat: sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
  const ar = 0.59719 * ir + 0.35458 * ig + 0.04823 * ib;
  const ag = 0.076 * ir + 0.90834 * ig + 0.01566 * ib;
  const ab = 0.0284 * ir + 0.13383 * ig + 0.83777 * ib;

  const fr = rrtAndOdtFit(ar);
  const fg = rrtAndOdtFit(ag);
  const fb = rrtAndOdtFit(ab);

  // ACESOutputMat: ODT_SAT => XYZ => D60_2_D65 => sRGB
  out[0] = saturate(1.60475 * fr - 0.53108 * fg - 0.07367 * fb);
  out[1] = saturate(-0.10208 * fr + 1.10813 * fg - 0.00605 * fb);
  out[2] = saturate(-0.00327 * fr - 0.07276 * fg + 1.07602 * fb);
  return out;
}

/** 선형 → sRGB 전달 함수(0~1). */
export function linearToSrgb(x: number): number {
  const v = Math.min(1, Math.max(0, x));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/**
 * 렌더 타깃 readback 을 선형 float 버퍼로 — Float RT 는 그대로(같은 인스턴스),
 * 8bit 폴백(EXT_color_buffer_float 없는 환경)은 0~255 를 0~1 로 편다. 8bit
 * 는 1.0 위가 잘리고 어두운 값이 양자화되지만 미니맵 배경으로는 쓸 만하다.
 */
export function toLinearFloatPixels(
  rgba: Float32Array | Uint8Array,
): Float32Array {
  if (rgba instanceof Float32Array) return rgba;
  const out = new Float32Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 1) out[i] = rgba[i] / 255;
  return out;
}

/**
 * Float 렌더 타깃 readback(선형 RGBA, **아래 행부터** — WebGL readPixels
 * 규약) → ImageData 용 버퍼(ACES 톤매핑 + sRGB, 위 행부터, 알파 255). 새
 * 버퍼를 돌려주고 입력은 건드리지 않는다. 길이가 width×height×4 와 다르면
 * null.
 */
export function toDisplayPixels(
  rgba: Float32Array,
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    rgba.length !== width * height * 4
  ) {
    return null;
  }

  // ImageData 생성자가 SharedArrayBuffer 를 거부하므로 ArrayBuffer 로 명시.
  const out = new Uint8ClampedArray(new ArrayBuffer(rgba.length));
  const rowStride = width * 4;
  const mapped: RgbTriplet = [0, 0, 0];
  for (let row = 0; row < height; row += 1) {
    const src = (height - 1 - row) * rowStride;
    const dst = row * rowStride;
    for (let i = 0; i < rowStride; i += 4) {
      acesFilmicToneMap(
        rgba[src + i],
        rgba[src + i + 1],
        rgba[src + i + 2],
        mapped,
      );
      out[dst + i] = Math.round(linearToSrgb(mapped[0]) * 255);
      out[dst + i + 1] = Math.round(linearToSrgb(mapped[1]) * 255);
      out[dst + i + 2] = Math.round(linearToSrgb(mapped[2]) * 255);
      out[dst + i + 3] = 255;
    }
  }
  return out;
}
