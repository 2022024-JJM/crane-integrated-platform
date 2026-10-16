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

/**
 * 평면도(직교 탑뷰) 윤곽선 — 위에서 본 크레인은 지브·타워가 1~2px 선이라
 * 지도 텍스처에 묻힌다. 모든 장비를 어두운 가는 선으로 둘러 형체를 세운다.
 * **운전 상태는 라벨 색 하나로만 말한다** — 윤곽은 상태와 무관하게 같은 선이다.
 * 상태 외곽선(commError 등)이 있는 장비는 그 색이 대신한다(같은 자리). 색은 주황이 번지지
 * 않는 어두운 난색 — 순검정은 지도 그림자선과 구분되지 않는다.
 */
export const PLAN_VIEW_OUTLINE_COLOR = '#2a1d10';
/** 평면도 윤곽선 두께(px) — 상태 외곽선보다 얇아 상태가 켜지면 차이가 보인다. */
export const PLAN_VIEW_OUTLINE_PX = 1;
/**
 * 평면도 윤곽 불투명도 — 진한 검정 선은 3D 모델과 따로 노는 "도면 위에 덧그린
 * 선" 으로 읽힌다. 바탕이 비치게 섞어 모델의 그림자선처럼 보이게 한다.
 */
export const PLAN_VIEW_OUTLINE_OPACITY = 0.4;
/** 상태 외곽선(10.5~)보다 먼저 그려 겹치면 상태 색이 위에 온다. */
export const PLAN_VIEW_OUTLINE_RENDER_ORDER = 10.4;

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
