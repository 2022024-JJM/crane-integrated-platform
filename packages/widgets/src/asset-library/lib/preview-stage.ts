import type { AssetFileUrlState } from '@crane/features/asset-library';

/** 미리보기를 그림으로 볼지 3D 로 볼지 — 사용자가 고른다. */
export const PREVIEW_MODES = ['image', '3d'] as const;
export type PreviewMode = (typeof PREVIEW_MODES)[number];

/**
 * 미리보기의 그림 자리에 놓을 것.
 * - `thumbnail`: 썸네일.
 * - `opening`: 뷰어 자리와 불러오는 표시만. 파일은 아직 받지 않는다.
 * - `viewer`: 뷰어가 파일을 연다.
 */
export type PreviewStage = 'thumbnail' | 'opening' | 'viewer';

export interface PreviewStageInput {
  previewMode: PreviewMode;
  /** 돌려 볼 수 있는 자산인가(모델·지도·배경). */
  interactive: boolean;
  fileStatus: AssetFileUrlState['status'];
  /** 이 자산에 잠시 머물렀는가 — 지나치는 자산의 파일은 받지 않는다. */
  settled: boolean;
}

/**
 * 파일 크기는 보지 않는다 — 모든 3D 자산이 같은 방식으로 열린다. 큰 파일이
 * 목록을 훑는 중에 내려오는 것은 머묾 지연(`settled`)이 막는다.
 */
export function resolvePreviewStage({
  previewMode,
  interactive,
  fileStatus,
  settled,
}: PreviewStageInput): PreviewStage {
  if (previewMode !== '3d' || !interactive || fileStatus === 'missing') {
    return 'thumbnail';
  }
  // 3D 로 열 자산은 여는 동안에도 썸네일을 거치지 않는다 — 그림이 떴다가
  // 불러오는 화면으로 바뀌면 자산을 넘길 때마다 깜빡인다.
  return fileStatus === 'ready' && settled ? 'viewer' : 'opening';
}
