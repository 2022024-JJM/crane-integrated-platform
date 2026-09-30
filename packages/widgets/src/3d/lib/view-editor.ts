import {
  createEmptySplitSlots,
  SCENE_SPLIT_SLOT_COUNT,
  SCENE_VIEW_NAME_MAX,
  SCENE_VIEWS_MAX,
  sceneViewNameKey,
  type SavedCameraInfo,
  type SavedSceneInfo,
  type SavedSceneView,
  type SavedViewSplit,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 씬 뷰·분할의 에디터 쪽 순수 로직 — Project 팔레트 "뷰" 탭의 편집을
 * SavedSceneInfo 갱신으로 바꾼다. 방어(로드·저장 경계)는 domain 의
 * sanitize-views.ts 이고 여기는 사용자 조작 한 번의 의미다.
 *
 * 갱신 함수는 결과가 같으면 **같은 참조**를 돌려준다 — 세터가 그걸 보고 씬을
 * 건드리지 않아 히스토리·dirty 가 오염되지 않는다(ruler-editor 와 같은 규칙).
 */

export type SceneViewNameError = 'empty' | 'tooLong' | 'duplicate';

/**
 * 뷰 목록 행을 분할 칸으로 끄는 드래그의 dataTransfer 타입. 모델 드래그
 * (`SCENE_MODEL_DRAG_TYPE`)와 달리 `text/plain` 을 함께 싣지 않는다 — 캔버스
 * 드롭(use-scene-drop)이 뷰 id 를 모델 배치로 오해하지 않게.
 */
export const SCENE_VIEW_DRAG_TYPE = 'application/x-scene-view-id';

export function readSceneViewDrag(dataTransfer: DataTransfer): string | null {
  const id = dataTransfer.getData(SCENE_VIEW_DRAG_TYPE);
  return id.length > 0 ? id : null;
}

export function isSceneViewDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(SCENE_VIEW_DRAG_TYPE);
}

/** 이름 입력 검증 — 저장할 이름은 앞뒤 공백을 뗀 것이다. */
export function validateSceneViewName(
  views: readonly SavedSceneView[] | undefined,
  name: string,
  excludeId?: string,
): SceneViewNameError | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'empty';
  if (trimmed.length > SCENE_VIEW_NAME_MAX) return 'tooLong';
  const key = sceneViewNameKey(trimmed);
  const duplicate = (views ?? []).some(
    (view) => view.id !== excludeId && sceneViewNameKey(view.name) === key,
  );
  return duplicate ? 'duplicate' : null;
}

export function isSceneViewLimitReached(
  views: readonly SavedSceneView[] | undefined,
): boolean {
  return (views ?? []).length >= SCENE_VIEWS_MAX;
}

function isTupleEqual(a: Vector3Tuple, b: Vector3Tuple): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** 칸이 전부 비고 고정도 아니면 분할 필드를 뗀다(sanitize 와 같은 생략 규칙). */
function normalizeViewSplit(
  split: SavedViewSplit | undefined,
): SavedViewSplit | undefined {
  if (!split) return undefined;
  const hasView = split.slots.some((slot) => slot !== null);
  if (!hasView && split.pinned !== true) return undefined;
  return split;
}

function withViewSplit(
  scene: SavedSceneInfo,
  split: SavedViewSplit | undefined,
): SavedSceneInfo {
  const next = normalizeViewSplit(split);
  if (next === scene.viewSplit) return scene;
  if (!next) {
    const { viewSplit: _removed, ...rest } = scene;
    void _removed;
    return rest;
  }
  return { ...scene, viewSplit: next };
}

function withViews(
  scene: SavedSceneInfo,
  views: SavedSceneView[],
): SavedSceneInfo {
  if (views.length === 0) {
    if (scene.views === undefined) return scene;
    const { views: _removed, ...rest } = scene;
    void _removed;
    return rest;
  }
  return { ...scene, views };
}

/**
 * 현재 카메라 구도를 뷰로 추가한다. 이름이 무효하거나 최대 개수면 씬을 그대로
 * 돌려준다(UI 가 먼저 막지만 다른 호출 경로에도 안전하게).
 */
export function withSceneViewAdded(
  scene: SavedSceneInfo,
  id: string,
  name: string,
  pose: SavedCameraInfo,
): SavedSceneInfo {
  if (isSceneViewLimitReached(scene.views)) return scene;
  if (validateSceneViewName(scene.views, name) !== null) return scene;
  if ((scene.views ?? []).some((view) => view.id === id)) return scene;
  const view: SavedSceneView = {
    id,
    name: name.trim(),
    position: pose.position,
    target: pose.target,
  };
  return withViews(scene, [...(scene.views ?? []), view]);
}

export function withSceneViewRenamed(
  scene: SavedSceneInfo,
  id: string,
  name: string,
): SavedSceneInfo {
  const views = scene.views ?? [];
  const index = views.findIndex((view) => view.id === id);
  if (index < 0) return scene;
  if (validateSceneViewName(views, name, id) !== null) return scene;
  const trimmed = name.trim();
  if (views[index].name === trimmed) return scene;
  const next = views.slice();
  next[index] = { ...views[index], name: trimmed };
  return withViews(scene, next);
}

/** 뷰의 구도를 현재 카메라로 다시 지정한다. */
export function withSceneViewPose(
  scene: SavedSceneInfo,
  id: string,
  pose: SavedCameraInfo,
): SavedSceneInfo {
  const views = scene.views ?? [];
  const index = views.findIndex((view) => view.id === id);
  if (index < 0) return scene;
  const current = views[index];
  if (
    isTupleEqual(current.position, pose.position) &&
    isTupleEqual(current.target, pose.target)
  ) {
    return scene;
  }
  const next = views.slice();
  next[index] = {
    ...current,
    position: pose.position,
    target: pose.target,
  };
  return withViews(scene, next);
}

/** 뷰를 지운다. 그 뷰가 든 분할 칸도 함께 비운다. */
export function withSceneViewRemoved(
  scene: SavedSceneInfo,
  id: string,
): SavedSceneInfo {
  const views = scene.views ?? [];
  if (!views.some((view) => view.id === id)) return scene;
  let next = withViews(
    scene,
    views.filter((view) => view.id !== id),
  );
  const split = next.viewSplit;
  if (split && split.slots.includes(id)) {
    next = withViewSplit(next, {
      ...split,
      slots: split.slots.map((slot) => (slot === id ? null : slot)),
    });
  }
  return next;
}

/**
 * 뷰를 목록의 다른 자리로 옮긴다. `insertBefore` 는 **현재 목록** 기준으로 그
 * 앞에 끼울 index(0 ~ 길이, 길이는 맨 뒤)다 — 드래그 중 보이는 빈자리와
 * 같은 셈법이라 UI 가 따로 보정하지 않는다. 제자리(자기 앞·자기 바로 뒤)면
 * 같은 참조다. 순서는 우상단 고정 줄의 버튼 순서다.
 */
export function withSceneViewMoved(
  scene: SavedSceneInfo,
  id: string,
  insertBefore: number,
): SavedSceneInfo {
  const views = scene.views ?? [];
  const from = views.findIndex((view) => view.id === id);
  if (from < 0) return scene;
  if (!Number.isInteger(insertBefore)) return scene;
  const clamped = Math.min(Math.max(insertBefore, 0), views.length);
  const to = clamped > from ? clamped - 1 : clamped;
  if (to === from) return scene;
  const next = views.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return withViews(scene, next);
}

export function withSceneViewPinned(
  scene: SavedSceneInfo,
  id: string,
  pinned: boolean,
): SavedSceneInfo {
  const views = scene.views ?? [];
  const index = views.findIndex((view) => view.id === id);
  if (index < 0) return scene;
  const current = views[index];
  if ((current.pinned === true) === pinned) return scene;
  const next = views.slice();
  if (pinned) {
    next[index] = { ...current, pinned: true };
  } else {
    const { pinned: _removed, ...rest } = current;
    void _removed;
    next[index] = rest;
  }
  return withViews(scene, next);
}

/**
 * 칸에 뷰를 놓는다(`viewId` null 이면 비움). 같은 뷰가 다른 칸에 있었으면
 * 그 칸을 비워 **이동**이 된다 — 한 뷰는 한 칸에만 있다. 존재하지 않는 뷰나
 * 범위 밖 칸은 무시한다.
 */
export function withSplitSlot(
  scene: SavedSceneInfo,
  slot: number,
  viewId: string | null,
): SavedSceneInfo {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SCENE_SPLIT_SLOT_COUNT) {
    return scene;
  }
  if (viewId !== null && !(scene.views ?? []).some((v) => v.id === viewId)) {
    return scene;
  }
  const slots = scene.viewSplit?.slots
    ? scene.viewSplit.slots.slice(0, SCENE_SPLIT_SLOT_COUNT)
    : createEmptySplitSlots();
  while (slots.length < SCENE_SPLIT_SLOT_COUNT) slots.push(null);
  if (slots[slot] === viewId) return scene;
  const next = slots.map((current, index) => {
    if (index === slot) return viewId;
    return viewId !== null && current === viewId ? null : current;
  });
  return withViewSplit(scene, { ...scene.viewSplit, slots: next });
}

export function withSplitPinned(
  scene: SavedSceneInfo,
  pinned: boolean,
): SavedSceneInfo {
  const current = scene.viewSplit;
  if ((current?.pinned === true) === pinned) return scene;
  const slots = current?.slots ?? createEmptySplitSlots();
  if (pinned) {
    return withViewSplit(scene, { slots, pinned: true });
  }
  return withViewSplit(scene, { slots });
}
