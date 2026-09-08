/*
 * 선택·유사 공정 강조 규칙 (PRD FR-5).
 *
 * 강조 강도는 PRD 표의 범위 안에서 한 값으로 고정한다:
 *  - 직접 선택 대상: 100%
 *  - 동일 공정 단계: 45~60% → 0.55
 *  - 같은 공정군의 유사 단계: 유사 공정 그룹이 확정되기 전이므로 계층을 두지 않는다
 *    (PRD: "동일 stage 만 유사 대상")
 *  - 무관한 대상: 10~20% → 0.15 (상호작용은 유지)
 *
 * 순수 함수 — 뷰어는 이 판정을 받아 재질 불투명도만 바꾼다.
 */

export type EmphasisTier = 'selected' | 'sameStage' | 'unrelated' | 'neutral'

/** 3D 형상(점군·경계·바닥)에 곱하는 불투명도 배율 */
export const EMPHASIS_GEOMETRY_OPACITY: Record<EmphasisTier, number> = {
  selected: 1,
  sameStage: 0.55,
  unrelated: 0.15,
  neutral: 1,
}

/**
 * 라벨(DOM)에 곱하는 불투명도 배율 — 형상보다 바닥을 높게 잡는다.
 * 무관 대상도 "상호작용 가능한 형태는 유지"해야 하므로(FR-5), 라벨이 클릭
 * 대상으로 남을 만큼은 보여야 한다.
 */
export const EMPHASIS_LABEL_OPACITY: Record<EmphasisTier, number> = {
  selected: 1,
  sameStage: 0.8,
  unrelated: 0.38,
  neutral: 1,
}

export interface BaySelection {
  bayId: string
  /** 선택 베이의 현재 공정 단계 (bayStage 결과) — 없으면 stage 비교를 하지 않는다 */
  stage: string | null
}

/**
 * 이 베이의 강조 계층.
 * 선택이 없으면 전부 neutral(100%) — 아무도 가라앉지 않는다.
 */
export function emphasisFor(
  bayId: string,
  stage: string | null,
  selection: BaySelection | null
): EmphasisTier {
  if (!selection) return 'neutral'
  if (bayId === selection.bayId) return 'selected'
  if (selection.stage !== null && stage !== null && stage === selection.stage) return 'sameStage'
  return 'unrelated'
}
