import type { AssetViewMode } from '@crane/features/asset-library';

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

export function createViewerDisplay(theme: string): ViewerDisplay {
  return {
    viewMode: 'lit',
    background: theme === 'dark' ? 'dark' : 'light',
    showGrid: true,
    showDimensions: true,
    turntable: false,
  };
}

export function nextViewerBackground(
  background: ViewerBackground,
): ViewerBackground {
  return VIEWER_BACKGROUNDS[
    (VIEWER_BACKGROUNDS.indexOf(background) + 1) % VIEWER_BACKGROUNDS.length
  ];
}
