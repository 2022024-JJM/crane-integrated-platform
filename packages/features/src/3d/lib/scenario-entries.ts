import {
  resolveMappingTagKey,
  type SavedModelInfo,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import type {
  ScenarioTag,
  SimulationScenario,
} from '@crane/domain/virtual-tag';

/**
 * 시나리오 태그를 러너·리포트가 보는 "키 하나 = 태그 하나" 로 편다.
 *
 * 키는 저장하지 않고 **그 씬의 모델**로 조립한다 — 시나리오는 `modelId + code`
 * 만 들어, 에디터에서 모델의 크레인을 바꾸면 시나리오가 따라온다. 코드가 모델
 * 맵핑에 아직 있으면 그 맵핑의 `craneId` 덮어쓰기를 존중한다.
 *
 * 건너뛰는 것은 이유와 함께 `issues` 로 돌려준다 — 패널이 그 행을 amber 로
 * 보이고 값은 내보내지 않는다.
 */
export interface VirtualTagEntry {
  key: string;
  tag: ScenarioTag;
  modelId: string;
  /** 표시용 — 모델 이름(`equipName`). */
  modelName: string;
  craneId: string;
}

export type ScenarioTagIssueReason =
  | 'model-missing'
  | 'crane-missing'
  | 'duplicate-key';

export interface ScenarioTagIssue {
  tagId: string;
  modelId: string;
  code: string;
  reason: ScenarioTagIssueReason;
}

export interface ScenarioEntryResult {
  entries: VirtualTagEntry[];
  issues: ScenarioTagIssue[];
}

const EMPTY_RESULT: ScenarioEntryResult = Object.freeze({
  entries: [],
  issues: [],
});

/** 모델에서 코드의 키 — 맵핑이 있으면 그 맵핑(craneId 덮어쓰기 포함)으로. */
function resolveTagKeyForModel(
  model: SavedModelInfo,
  code: string,
): string | undefined {
  const mapping = model.tagMappings?.find((m) => m.code === code);
  return resolveMappingTagKey(model, mapping ?? { code });
}

export function collectScenarioEntries(
  scenario: SimulationScenario | null | undefined,
  sceneInfo: SavedSceneInfo | null | undefined,
): ScenarioEntryResult {
  if (!scenario || scenario.tags.length === 0) return EMPTY_RESULT;
  const modelsById = new Map<string, SavedModelInfo>(
    (sceneInfo?.models ?? []).map((m) => [m.id, m]),
  );
  const entries: VirtualTagEntry[] = [];
  const issues: ScenarioTagIssue[] = [];
  const seenKeys = new Set<string>();
  for (const tag of scenario.tags) {
    const issue = (reason: ScenarioTagIssueReason) => {
      issues.push({
        tagId: tag.id,
        modelId: tag.modelId,
        code: tag.code,
        reason,
      });
    };
    const model = modelsById.get(tag.modelId);
    if (!model) {
      issue('model-missing');
      continue;
    }
    const key = resolveTagKeyForModel(model, tag.code);
    if (!key) {
      issue('crane-missing');
      continue;
    }
    if (seenKeys.has(key)) {
      issue('duplicate-key');
      continue;
    }
    seenKeys.add(key);
    entries.push({
      key,
      tag,
      modelId: model.id,
      modelName: model.equipName,
      craneId: model.craneId ?? '',
    });
  }
  return { entries, issues };
}
