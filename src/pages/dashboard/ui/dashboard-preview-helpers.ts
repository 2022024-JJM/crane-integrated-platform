export interface DashboardPreviewPosition {
  x: number;
  y: number;
}

export interface DashboardPreviewSize {
  width: number;
}

const PREVIEW_MARGIN = 24;
const PREVIEW_MAX_WIDTH = 460;
const PREVIEW_MIN_WIDTH = 320;
const PREVIEW_ASPECT_RATIO = 16 / 9;
const PREVIEW_HEADER_HEIGHT = 58;

export function getDefaultPreviewWidth(viewportWidth: number) {
  return Math.min(
    PREVIEW_MAX_WIDTH,
    Math.max(PREVIEW_MIN_WIDTH, Math.floor(viewportWidth * 0.4)),
  );
}

export function getPreviewBodyHeight(width: number) {
  return Math.round(width / PREVIEW_ASPECT_RATIO);
}

export function getPreviewHeight(width: number) {
  return getPreviewBodyHeight(width) + PREVIEW_HEADER_HEIGHT;
}

export function clampPreviewWidth(width: number, viewportWidth: number) {
  const maxWidth = Math.max(
    PREVIEW_MIN_WIDTH,
    viewportWidth - PREVIEW_MARGIN * 2,
  );

  return Math.min(Math.max(width, PREVIEW_MIN_WIDTH), maxWidth);
}

export function getClampedPreviewWidth(width: number) {
  if (typeof window === 'undefined') {
    return width;
  }

  return clampPreviewWidth(width, window.innerWidth);
}

export function getPreviewFrameHeight(width: number) {
  return Math.round(width / PREVIEW_ASPECT_RATIO) + PREVIEW_HEADER_HEIGHT;
}

export function clampPreviewPosition(
  position: DashboardPreviewPosition,
  width: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const previewWidth = clampPreviewWidth(width, viewportWidth);
  const previewHeight = getPreviewFrameHeight(previewWidth);
  const maxX = Math.max(
    PREVIEW_MARGIN,
    viewportWidth - previewWidth - PREVIEW_MARGIN,
  );
  const maxY = Math.max(
    PREVIEW_MARGIN,
    viewportHeight - previewHeight - PREVIEW_MARGIN,
  );

  return {
    x: Math.min(Math.max(position.x, PREVIEW_MARGIN), maxX),
    y: Math.min(Math.max(position.y, PREVIEW_MARGIN), maxY),
  };
}

export function isSamePosition(
  current: DashboardPreviewPosition,
  next: DashboardPreviewPosition,
) {
  return current.x === next.x && current.y === next.y;
}

export function getDashboardPreviewDefaultPosition(): DashboardPreviewPosition {
  if (typeof window === 'undefined') {
    return { x: PREVIEW_MARGIN, y: PREVIEW_MARGIN };
  }

  const previewWidth = getDefaultPreviewWidth(window.innerWidth);
  const previewHeight = getPreviewHeight(previewWidth);

  return {
    x: Math.max(
      PREVIEW_MARGIN,
      window.innerWidth - previewWidth - PREVIEW_MARGIN,
    ),
    y: Math.max(
      PREVIEW_MARGIN,
      window.innerHeight - previewHeight - PREVIEW_MARGIN,
    ),
  };
}

export function getDashboardPreviewDefaultSize(): DashboardPreviewSize {
  if (typeof window === 'undefined') {
    return { width: PREVIEW_MAX_WIDTH };
  }

  return {
    width: getDefaultPreviewWidth(window.innerWidth),
  };
}
