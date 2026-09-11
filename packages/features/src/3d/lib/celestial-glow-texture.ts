import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * 하늘의 태양·달 표식용 방사형 그라데이션 텍스처 — 2D 캔버스로 그린다.
 * 에셋 파일이 없고 크기가 작아(128px) 생성 비용은 무시할 수준이다.
 *
 * `document` 가 없는 환경(단위 테스트·SSR)에선 null — 호출자는 표식을
 * 그리지 않는다. 텍스처는 호출자 소유이므로 언마운트 때 dispose 한다.
 */
export function createRadialGlowTexture(
  size: number,
  stops: ReadonlyArray<readonly [offset: number, color: string]>,
): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 태양 — 작은 백색 핵 + 넓고 옅은 난색 광륜. 하드한 원판이 아니라
 * 글로우인 이유: 배경 EXR 이 흐린 하늘이라 원판을 박으면 사진과 따로
 * 논다. 글로우는 "구름 뒤에서 비치는 해" 로 읽힌다.
 */
export function createSunGlowTexture(): CanvasTexture | null {
  return createRadialGlowTexture(128, [
    [0, 'rgba(255, 252, 240, 1)'],
    [0.12, 'rgba(255, 246, 214, 0.95)'],
    [0.3, 'rgba(255, 224, 160, 0.45)'],
    [0.6, 'rgba(255, 200, 120, 0.12)'],
    [1, 'rgba(255, 190, 110, 0)'],
  ]);
}

/** 달 — 창백한 원판, 가장자리만 부드럽게. */
export function createMoonTexture(): CanvasTexture | null {
  return createRadialGlowTexture(128, [
    [0, 'rgba(236, 240, 250, 1)'],
    [0.42, 'rgba(226, 232, 246, 0.95)'],
    [0.5, 'rgba(210, 220, 240, 0.35)'],
    [0.62, 'rgba(200, 212, 236, 0.1)'],
    [1, 'rgba(200, 212, 236, 0)'],
  ]);
}
