/**
 * 모델 포커스 중 나머지 모델의 흐림(투명도) 파생.
 *
 * 흐림 상태를 저장하지 않는다 — 씬 데이터의 opacity 가 단일 소스이고,
 * 렌더 때마다 여기서 실효 투명도를 계산한다. 포커스가 풀리면 prop 이 원래
 * 값으로 돌아가고 ModelMesh 가 clone material 을 dispose·원본 복원하므로
 * 별도 "복원" 절차가 없다. ui/*.tsx 안에서 수치 계산을 하지 않는 규약대로
 * lib 에 둔다(scene-shadow.ts 참고).
 */

/** 포커스 중 나머지 모델의 투명도 상한. */
export const FOCUS_GHOST_OPACITY = 0.1;

/** 포커스 중이고 이 모델이 포커스 대상이 아니면 true. */
export function isFocusGhosted(
  modelId: string,
  focusedModelId: string | null,
): boolean {
  return focusedModelId !== null && modelId !== focusedModelId;
}

/**
 * 실효 투명도. 흐려질 모델은 원래 값과 상한 중 작은 쪽 — 원래 0.1 미만인
 * 모델을 오히려 진하게 만들지 않는다. 포커스 대상과 미포커스 상태는 원래 값.
 */
export function resolveFocusOpacity(
  modelId: string,
  focusedModelId: string | null,
  baseOpacity: number,
): number {
  if (!isFocusGhosted(modelId, focusedModelId)) {
    return baseOpacity;
  }
  return Math.min(baseOpacity, FOCUS_GHOST_OPACITY);
}
