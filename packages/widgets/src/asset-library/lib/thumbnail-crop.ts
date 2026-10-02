/**
 * 썸네일 만들기 — 렌더된 화면에서 물체가 차지한 영역만 잘라 정사각 캔버스에
 * 여백을 두고 채운다.
 *
 * 카메라는 물체의 경계 구가 화면에 들어오게 맞추므로, 타워크레인처럼 가는
 * 물체는 화면의 작은 일부만 쓴다. 그대로 찍으면 자산마다 썸네일 속 크기가
 * 제각각이라 목록이 들쭉날쭉하다. 투명 배경이라 불투명한 픽셀의 범위가 곧
 * 물체의 범위다.
 */

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 이 알파 이하는 가장자리 번짐으로 보고 물체로 세지 않는다. */
const ALPHA_THRESHOLD = 8;
/** 썸네일 한 변에서 물체가 차지하는 비율(나머지는 여백). */
export const THUMBNAIL_FILL = 0.88;

/**
 * RGBA 픽셀에서 불투명한 영역의 경계 사각형. 전부 투명하면 null.
 */
export function findOpaqueBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): PixelRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x * 4 + 3] <= ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * 잘라낸 영역을 정사각 `size` 안에 종횡비를 지켜 가운데에 놓을 자리.
 * 긴 변이 `size × fill` 이 된다.
 */
export function fitRectInSquare(
  rect: Pick<PixelRect, 'width' | 'height'>,
  size: number,
  fill = THUMBNAIL_FILL,
): PixelRect {
  const longest = Math.max(rect.width, rect.height, 1);
  const scale = (size * fill) / longest;
  const width = rect.width * scale;
  const height = rect.height * scale;
  return { x: (size - width) / 2, y: (size - height) / 2, width, height };
}

/**
 * 방금 렌더한 WebGL 캔버스로 정사각 썸네일을 만든다. 2D 컨텍스트를 못 얻으면
 * null. 물체가 보이지 않으면(전부 투명) 화면 가운데 정사각을 그대로 쓴다.
 */
export function renderThumbnail(
  source: HTMLCanvasElement,
  size: number,
): HTMLCanvasElement | null {
  const scratch = document.createElement('canvas');
  scratch.width = source.width;
  scratch.height = source.height;
  const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
  const output = document.createElement('canvas');
  output.width = size;
  output.height = size;
  const outputContext = output.getContext('2d');
  if (!scratchContext || !outputContext) return null;

  scratchContext.drawImage(source, 0, 0);
  const bounds =
    source.width > 0 && source.height > 0
      ? findOpaqueBounds(
          scratchContext.getImageData(0, 0, source.width, source.height).data,
          source.width,
          source.height,
        )
      : null;

  if (!bounds) {
    const side = Math.min(source.width, source.height);
    outputContext.drawImage(
      scratch,
      (source.width - side) / 2,
      (source.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
    return output;
  }

  const target = fitRectInSquare(bounds, size);
  outputContext.imageSmoothingQuality = 'high';
  outputContext.drawImage(
    scratch,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    target.x,
    target.y,
    target.width,
    target.height,
  );
  return output;
}

/**
 * 원본 한가운데에서 `aspect`(가로 ÷ 세로) 비율로 잘라낼 수 있는 가장 큰 자리.
 * 배경(파노라마)처럼 화면을 가득 채운 그림의 썸네일에 쓴다 — 물체의 범위를
 * 찾을 것이 없어, 비율만 맞춰 가운데를 쓴다. 크기나 비율이 올바르지 않으면
 * 원본 전체를 돌려준다.
 */
export function centerCropRect(
  source: Pick<PixelRect, 'width' | 'height'>,
  aspect: number,
): PixelRect {
  const full = { x: 0, y: 0, width: source.width, height: source.height };
  if (!(source.width > 0) || !(source.height > 0)) return full;
  if (!Number.isFinite(aspect) || aspect <= 0) return full;
  if (source.width / source.height > aspect) {
    const width = source.height * aspect;
    return {
      x: (source.width - width) / 2,
      y: 0,
      width,
      height: source.height,
    };
  }
  const height = source.width / aspect;
  return { x: 0, y: (source.height - height) / 2, width: source.width, height };
}

/**
 * 방금 렌더한 WebGL 캔버스의 가운데를 `width × height` 로 잘라 채운 썸네일.
 * 2D 컨텍스트를 못 얻거나 캔버스가 비어 있으면 null.
 */
export function renderCoverThumbnail(
  source: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement | null {
  if (source.width <= 0 || source.height <= 0) return null;
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) return null;
  const crop = centerCropRect(source, width / height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  );
  return output;
}
