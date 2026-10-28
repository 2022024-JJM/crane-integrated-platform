import type { RigDefinition, SavedModelInfo } from '@crane/domain/3d';

/**
 * 리깅 탭 드롭다운의 리그 목록 — 모델과 같은 자산(`assetId` = 모델의
 * `asset.id`)의 리그 전부. 지금 붙어 있는 리그가 그 밖이면 앞에 더해 붙어
 * 있는데 "리그 없음" 으로 읽히지 않게 한다. 순서는 씬 `rigs[]` 그대로.
 * 자산 참조가 없는 모델은 붙어 있는 리그만 본다.
 */
export function listRigChoices(
  rigs: readonly RigDefinition[],
  model: Pick<SavedModelInfo, 'rigId' | 'asset'>,
): RigDefinition[] {
  const assetId = model.asset?.id;
  const choices = rigs.filter(
    (rig) => assetId !== undefined && rig.assetId === assetId,
  );
  const assigned = model.rigId
    ? rigs.find((rig) => rig.id === model.rigId)
    : undefined;
  if (assigned && !choices.includes(assigned)) return [assigned, ...choices];
  return choices;
}
