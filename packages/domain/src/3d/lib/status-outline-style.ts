import type { EquipmentOutlineState } from '@crane/core/types/status';

/**
 * 장비 상태 외곽선의 모양 — 판정은 features/3d lib/model-outline-state.ts,
 * 그리기는 ui/gltf-model.tsx(ObjectSilhouetteOutline).
 *
 * 색은 ACMS 매뉴얼 그림에서 가져왔다. 적색은 Play Back 화면의 GC-1 외곽선,
 * 회색은 첫 화면의 OC-3·TTC-7 외곽선(주황과 섞이지 않은 가장 밝은 무채색
 * 픽셀)이다. 황색 외곽선이 찍힌 그림은 매뉴얼에 없어 Crane ID Box 의 황색을
 * 쓴다(ui/model-label.tsx 의 운전 전원 On 과 같은 값).
 */
export type StatusOutlineKind = Exclude<EquipmentOutlineState, 'none'>;

export const STATUS_OUTLINE_COLORS: Record<StatusOutlineKind, string> = {
  commError: '#e0e0e0',
  slowdown: '#ffff00',
  endstop: '#ff0000',
};

/** 상태 외곽선의 화면 두께(px) — 선택·충돌 테두리(SILHOUETTE_OUTLINE_PX)보다 얇다. */
export const STATUS_OUTLINE_PX = 2;

/**
 * 헐의 렌더 순서. 선택·충돌 테두리(lib/silhouette-outline.ts 의 헐 기본값)보다
 * 먼저 그려 같은 장비에 겹치면 선택·충돌 색이 위에 온다. 상태끼리는 위험한
 * 쪽이 위다 — 화면에서 겹친 두 장비의 테두리가 만나는 자리에 적색이 남는다.
 */
const STATUS_OUTLINE_RENDER_ORDER: Record<StatusOutlineKind, number> = {
  commError: 10.5,
  slowdown: 10.6,
  endstop: 10.7,
};

export function isStatusOutlineVisible(
  state: EquipmentOutlineState | undefined,
): state is StatusOutlineKind {
  return (
    typeof state === 'string' &&
    state !== 'none' &&
    Object.hasOwn(STATUS_OUTLINE_COLORS, state)
  );
}

export function statusOutlineRenderOrder(kind: StatusOutlineKind): number {
  return STATUS_OUTLINE_RENDER_ORDER[kind];
}
