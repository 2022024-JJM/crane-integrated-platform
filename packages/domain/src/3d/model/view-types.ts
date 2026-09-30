import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 씬 뷰 — 에디터에서 저작해 씬 파일에 저장하는 이름 붙은 카메라 구도.
 * 모니터링·3D 플레이·에디터가 같은 목록을 읽어 카메라를 옮긴다.
 *
 * 뷰는 씬 객체가 아니다(선택·기즈모·레지스트리 대상이 아님) — id 는 모델·
 * 텍스트·눈금의 id 집합과 별개로 관리한다.
 */
export interface SavedSceneView {
  id: string;
  name: string;
  position: Vector3Tuple;
  target: Vector3Tuple;
  /**
   * 화면 우상단 고정 줄에 버튼으로 상시 표시. true 만 저장한다 — 고정하지
   * 않은 뷰는 필드가 빠져 기존 저장본과 diff 가 없다.
   */
  pinned?: boolean;
}

/**
 * 분할 화면 — 뷰를 칸에 배정한 것. 칸은 2×2 이고 순서는 좌상·우상·좌하·우하,
 * `null` 은 빈 칸이다. 실제 화면 배치(빈 행·열 접기)는 lib/view-split-layout.ts.
 */
export interface SavedViewSplit {
  /** 길이 SCENE_SPLIT_SLOT_COUNT. 값은 `views` 의 id. */
  slots: (string | null)[];
  /** 분할 버튼을 우상단 고정 줄에 상시 표시. true 만 저장한다. */
  pinned?: boolean;
}

export const SCENE_VIEWS_MAX = 12;
export const SCENE_VIEW_NAME_MAX = 24;
export const SCENE_SPLIT_SLOT_COUNT = 4;
/** 칸 격자의 열 수 — 칸 index → (행, 열) 변환의 기준. */
export const SCENE_SPLIT_COLUMNS = 2;

export function createEmptySplitSlots(): (string | null)[] {
  return Array.from({ length: SCENE_SPLIT_SLOT_COUNT }, () => null);
}
