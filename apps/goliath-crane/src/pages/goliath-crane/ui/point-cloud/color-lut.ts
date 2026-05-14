// intensity (0~255 정규화) → RGB 색상을 사전 계산해 두는 LUT.
// 참조 viewer.js 와 동일한 HSL 그래디언트 ((0.63 - n*0.63), 0.95, 0.55) 를
// 256 entry 로 미리 풀어두면 매 점마다의 setHSL 호출이 사라진다.

import * as THREE from 'three';
import { INTENSITY_COLOR_RANGE } from '../../lib/point-cloud/config';

const LUT_SIZE = 256;

const intensityLut = (() => {
  const arr = new Float32Array(LUT_SIZE * 3);
  const color = new THREE.Color();
  for (let i = 0; i < LUT_SIZE; i += 1) {
    const normalized = i / (LUT_SIZE - 1);
    color.setHSL(0.63 - normalized * 0.63, 0.95, 0.55);
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  return arr;
})();

/**
 * intensity 값을 0~LUT_SIZE-1 사이 정수 인덱스로 정규화한 뒤 LUT 에서 RGB 를
 * 가져와 colors[colorIndex..+2] 에 쓴다.
 */
export function writeIntensityColor(
  colors: Float32Array,
  colorIndex: number,
  intensity: number,
): void {
  const min = INTENSITY_COLOR_RANGE.min;
  const range = Math.max(1, INTENSITY_COLOR_RANGE.max - min);
  let normalized = (intensity - min) / range;
  if (normalized < 0) normalized = 0;
  else if (normalized > 1) normalized = 1;
  const lutIndex = (normalized * (LUT_SIZE - 1)) | 0;
  const lutOffset = lutIndex * 3;
  colors[colorIndex] = intensityLut[lutOffset];
  colors[colorIndex + 1] = intensityLut[lutOffset + 1];
  colors[colorIndex + 2] = intensityLut[lutOffset + 2];
}

/** fallback 단색을 colors[colorIndex..+2] 에 쓴다. */
export function writeSolidColor(
  colors: Float32Array,
  colorIndex: number,
  r: number,
  g: number,
  b: number,
): void {
  colors[colorIndex] = r;
  colors[colorIndex + 1] = g;
  colors[colorIndex + 2] = b;
}
