/**
 * 미니맵 탑뷰 스냅샷의 픽셀 후처리 — 렌더 타깃 readback 결과를 화면용 sRGB
 * 이미지로 만든다. 적용은 ui/scene-minimap-capture.tsx.
 *
 * 왜 여기서 톤매핑을 하는가: three(r183)는 렌더 타깃에 그릴 때 톤매핑·출력
 * 색공간 변환을 건너뛴다(WebGLPrograms.getParameters — `currentRenderTarget
 * === null` 일 때만 renderer.toneMapping). 그래서 readback 값은 선형·비톤매핑
 * 이라 화면보다 어둡고 하이라이트가 뭉개진다. 화면과 같은 룩(ACESFilmic →
 * sRGB)을 JS 로 한 번 적용한다. 512² 이하 이미지를 한 번 처리하는 비용이라
 * 셰이더 패스를 따로 두지 않는다.
 *
 * 자동 노출: solar 모드 밤에 찍힌 스냅샷은 야드가 어두워 미니맵으로 못 쓴다.
 * 평균 휘도를 목표값으로 끌어올리는 노출 배율을 계산한다(상한 있음 — 새까만
 * 스냅샷을 무한히 증폭해 노이즈만 남기지 않게).
 */

/** 자동 노출 목표 평균 휘도(선형, 0~1). 낮 야드 스냅샷 실측 근처 값. */
export const MINIMAP_TARGET_LUMINANCE = 0.18;
export const MINIMAP_EXPOSURE_MIN = 1;
export const MINIMAP_EXPOSURE_MAX = 6;

/**
 * 선형 RGBA(0~255) 버퍼의 평균 휘도(0~1). 알파는 무시한다. 빈 버퍼는 0.
 */
export function meanLinearLuminance(
  rgba: Uint8Array | Uint8ClampedArray,
): number {
  const pixels = rgba.length >> 2;
  if (pixels === 0) return 0;
  let sum = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    sum +=
      (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
  }
  return sum / pixels;
}

/**
 * 평균 휘도 → 노출 배율. 목표보다 밝으면 1(낮 화면은 손대지 않는다), 어두우면
 * 목표/평균 을 상한까지. 평균이 0·NaN 이면 상한.
 */
export function autoExposure(meanLuminance: number): number {
  if (!Number.isFinite(meanLuminance) || meanLuminance <= 0) {
    return MINIMAP_EXPOSURE_MAX;
  }
  const raw = MINIMAP_TARGET_LUMINANCE / meanLuminance;
  return Math.min(Math.max(raw, MINIMAP_EXPOSURE_MIN), MINIMAP_EXPOSURE_MAX);
}

/**
 * ACES filmic 근사(Narkowicz 2015) — three 의 ACESFilmicToneMapping 과 같은
 * 곡선군이고 미니맵 용도로 충분히 가깝다. 입력·출력 선형 0~1.
 */
export function acesFilmic(x: number): number {
  const v = Math.max(0, x);
  const mapped = (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14);
  return Math.min(1, Math.max(0, mapped));
}

/** 선형 → sRGB 전달 함수(0~1). */
export function linearToSrgb(x: number): number {
  const v = Math.min(1, Math.max(0, x));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/**
 * 렌더 타깃 readback(선형 RGBA, **아래 행부터** — WebGL readPixels 규약) →
 * ImageData 용 버퍼(sRGB, 위 행부터, 알파 255). 새 버퍼를 돌려주고 입력은
 * 건드리지 않는다. 길이가 width×height×4 와 다르면 null.
 *
 * 룩업 테이블(256)로 픽셀당 곱셈 한 번 + 조회 한 번 — 노출 배율은 선형 공간
 * 에서 곱하고, 톤매핑·sRGB 는 테이블에 접어 둔다. 노출 곱 뒤 값이 1 을 넘을 수
 * 있어 테이블은 [0, exposure] 범위를 256 칸으로 나눈다.
 */
export function toDisplayPixels(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  exposure: number,
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
  const gain = Number.isFinite(exposure) && exposure > 0 ? exposure : 1;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    lut[i] = Math.round(linearToSrgb(acesFilmic((i / 255) * gain)) * 255);
  }

  // ImageData 생성자가 SharedArrayBuffer 를 거부하므로 ArrayBuffer 로 명시.
  const out = new Uint8ClampedArray(new ArrayBuffer(rgba.length));
  const rowBytes = width * 4;
  for (let row = 0; row < height; row += 1) {
    const src = (height - 1 - row) * rowBytes;
    const dst = row * rowBytes;
    for (let i = 0; i < rowBytes; i += 4) {
      out[dst + i] = lut[rgba[src + i]];
      out[dst + i + 1] = lut[rgba[src + i + 1]];
      out[dst + i + 2] = lut[rgba[src + i + 2]];
      out[dst + i + 3] = 255;
    }
  }
  return out;
}
