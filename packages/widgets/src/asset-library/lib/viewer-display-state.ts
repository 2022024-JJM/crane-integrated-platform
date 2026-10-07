import { getStorageJson, setStorageJson } from '@crane/core/lib/safe-storage';
import {
  ASSET_VIEW_MODES,
  DEFAULT_PLAYBACK_SPEED,
  isPlaybackSpeed,
  REST_POSE_CLIP,
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
  /** 애니메이션을 돌리는 중인가. 클립이 없는 모델에는 뜻이 없다. */
  animationPlaying: boolean;
  animationSpeed: number;
  /**
   * 고른 클립 이름. null 이면 첫 클립, `REST_POSE_CLIP` 이면 애니메이션 없이
   * 기본 자세. 클립 이름은 자산마다 다르니 기억하지 않고 기본 자세만 기억한다.
   */
  animationClip: string | null;
}

export const DEFAULT_VIEW_MODE: AssetViewMode = 'lit';

export function createViewerDisplay(theme: string): ViewerDisplay {
  return {
    viewMode: DEFAULT_VIEW_MODE,
    background: theme === 'dark' ? 'dark' : 'light',
    showGrid: true,
    showDimensions: true,
    turntable: true,
    animationPlaying: true,
    animationSpeed: DEFAULT_PLAYBACK_SPEED,
    animationClip: null,
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
  'animationPlaying',
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
  if (isPlaybackSpeed(source.animationSpeed)) {
    picked.animationSpeed = source.animationSpeed;
  }
  // 클립 이름은 고르지 않는다 — 자산마다 다른 값이라 기억하면 다른 자산에서
  // 엉뚱한 클립을 가리킨다. 자산과 무관한 "애니메이션 없음" 만 기억한다.
  if (source.animationClip === REST_POSE_CLIP) {
    picked.animationClip = REST_POSE_CLIP;
  }
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

/**
 * 바뀐 항목만 기억해 둔 값 위에 덮어쓴다. 온전한 값이 없으면 쓰지 않는다.
 * 기본 자세에서 클립(또는 첫 클립)으로 돌아오면 기억한 기본 자세를 지운다.
 */
export function rememberViewerDisplay(patch: Partial<ViewerDisplay>): void {
  const remembered = readRememberedViewerDisplay();
  const changed = pickViewerDisplay({ ...patch });
  const forgetRest =
    'animationClip' in patch &&
    patch.animationClip !== REST_POSE_CLIP &&
    remembered.animationClip === REST_POSE_CLIP;
  if (Object.keys(changed).length === 0 && !forgetRest) return;
  const next = { ...remembered, ...changed };
  if (forgetRest) delete next.animationClip;
  setStorageJson(VIEWER_DISPLAY_STORAGE_KEY, next, 'session');
}
