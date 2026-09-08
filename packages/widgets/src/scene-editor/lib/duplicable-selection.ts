import type { SavedSceneInfo } from '@crane/domain/3d';

/**
 * 선택 중에 복제 액션이 다루는 대상(모델·텍스트)이 하나라도 있는지.
 *
 * 하단 선택 바의 복제 버튼 활성 여부를 정한다. 잠금 해제된 지도도 선택은
 * 되지만 복제 액션(`scene-manipulation-actions.ts` 의 `duplicateSelectedObject`)
 * 은 `models`·`texts` 만 훑고 `maps` 는 보지 않아 지도만 선택된 상태에서는
 * 무음 no-op 이다. 이 판정의 대상 집합은 그 복제 루프와 같아야 한다 —
 * 한쪽만 바꾸면 버튼 표시와 실제 동작이 어긋난다.
 *
 * 선택 스토어는 id 집합과 첫 항목 기준 종류 하나만 들고 있어 다중 선택
 * (Ctrl+A 로 지도+모델 혼합)에서는 종류를 알 수 없다. 그래서 씬 목록과
 * 대조한다. 혼합 선택은 모델·텍스트가 하나라도 있으면 활성이다.
 */
export function hasDuplicableSelection(
  selectedIds: ReadonlySet<string>,
  scene: SavedSceneInfo | null,
): boolean {
  if (selectedIds.size === 0 || !scene) {
    return false;
  }
  return (
    scene.models.some((m) => selectedIds.has(m.id)) ||
    (scene.texts ?? []).some((t) => selectedIds.has(t.id))
  );
}
