import { getStorageJson, setStorageJson } from '@crane/core/lib/safe-storage';
import {
  ASSET_VIEW_MODES,
  type AssetViewMode,
} from '@crane/features/asset-library';

/** 뷰어 배경. 테마와 무관하게 사용자가 고른다. */
export const VIEWER_BACKGROUNDS = ['dark', 'light', 'blueprint'] as const;
export type ViewerBackground = (typeof VIEWER_BACKGROUNDS)[number];

/**
 * 뷰어의 표시 상태. 뷰어 하나만 쓸 때는 뷰어가 직접 들고, 두 버전을 나란히
 * 볼 때는 바깥이 하나를 들고 양쪽에 넘긴다 — 한쪽만 와이어프레임이면 비교가
 * 되지 않는다.
 */
export interface ViewerDisplay {
  viewMode: AssetViewMode;
  background: ViewerBackground;
  showGrid: boolean;
  showDimensions: boolean;
  turntable: boolean;
}

export const DEFAULT_VIEW_MODE: AssetViewMode = 'lit';

export function createViewerDisplay(theme: string): ViewerDisplay {
  return {
    viewMode: DEFAULT_VIEW_MODE,
    background: theme === 'dark' ? 'dark' : 'light',
    showGrid: true,
    showDimensions: true,
    turntable: true,
  };
}

export function nextViewerBackground(
  background: ViewerBackground,
): ViewerBackground {
  return VIEWER_BACKGROUNDS[
    (VIEWER_BACKGROUNDS.indexOf(background) + 1) % VIEWER_BACKGROUNDS.length
  ];
}

const VIEWER_DISPLAY_TOGGLE_KEYS = [
  'showGrid',
  'showDimensions',
  'turntable',
] as const;

/**
 * 사용자가 고른 표시 상태는 자산을 넘기거나 목록·상세를 오가도 그대로 두려고
 * 탭이 열려 있는 동안 기억한다(sessionStorage).
 */
export const VIEWER_DISPLAY_STORAGE_KEY = 'crane:asset-library:viewer-display';

/** 표시 상태의 항목만, 값이 온전한 것만 골라낸다. */
function pickViewerDisplay(
  source: Record<string, unknown>,
): Partial<ViewerDisplay> {
  const picked: Partial<ViewerDisplay> = {};
  for (const key of VIEWER_DISPLAY_TOGGLE_KEYS) {
    const value = source[key];
    if (typeof value === 'boolean') picked[key] = value;
  }
  const viewMode = ASSET_VIEW_MODES.find((mode) => mode === source.viewMode);
  if (viewMode) picked.viewMode = viewMode;
  const background = VIEWER_BACKGROUNDS.find(
    (name) => name === source.background,
  );
  if (background) picked.background = background;
  return picked;
}

/** 기억해 둔 표시 상태. 고른 적 없는 항목은 빠진다(기본값을 쓴다). */
export function readRememberedViewerDisplay(): Partial<ViewerDisplay> {
  const stored = getStorageJson<Record<string, unknown>>(
    VIEWER_DISPLAY_STORAGE_KEY,
    'session',
  );
  if (typeof stored !== 'object' || stored === null) return {};
  return pickViewerDisplay(stored);
}

/** 바뀐 항목만 기억해 둔 값 위에 덮어쓴다. 온전한 값이 없으면 쓰지 않는다. */
export function rememberViewerDisplay(patch: Partial<ViewerDisplay>): void {
  const changed = pickViewerDisplay({ ...patch });
  if (Object.keys(changed).length === 0) return;
  setStorageJson(
    VIEWER_DISPLAY_STORAGE_KEY,
    { ...readRememberedViewerDisplay(), ...changed },
    'session',
  );
}
