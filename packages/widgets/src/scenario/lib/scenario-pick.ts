import {
  collectModelTagCodes,
  type ModelTagCode,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import type {
  ScenarioTag,
  SimulationScenario,
} from '@crane/domain/virtual-tag';
import { scenarioTagKey } from '@crane/domain/virtual-tag';
import { createScenarioTagDefaults } from '@crane/features/3d';

/**
 * 시나리오 선택 다이얼로그(새 시나리오 · 모델 추가 · 태그 수정)의 순수 로직.
 * 원천은 씬의 맵핑·상태 태그다 — 맵핑이 없는 모델은 목록에 없다.
 */
export interface PickableModel {
  modelId: string;
  equipName: string;
  craneId: string | undefined;
  codes: ModelTagCode[];
}

/** 맵핑·상태 태그가 하나라도 있는 모델, 씬 순서. */
export function listPickableModels(
  sceneInfo: SavedSceneInfo | null,
): PickableModel[] {
  const out: PickableModel[] = [];
  for (const model of sceneInfo?.models ?? []) {
    const codes = collectModelTagCodes(model);
    if (codes.length === 0) continue;
    out.push({
      modelId: model.id,
      equipName: model.equipName,
      craneId: model.craneId,
      codes,
    });
  }
  return out;
}

/** 체크 집합의 키 — `(modelId, code)`. 시나리오 태그 키와 같은 규칙. */
export function pickKey(modelId: string, code: string): string {
  return scenarioTagKey({ modelId, code });
}

/** 모델의 모든 선택 키. */
export function modelPickKeys(model: PickableModel): string[] {
  return model.codes.map((c) => pickKey(model.modelId, c.code));
}

/**
 * 모델 목록 검색 — 모델 이름·크레인에 맞으면 그 모델의 코드 전부, 아니면
 * 코드에 맞는 것만 남긴다(대소문자·앞뒤 공백 무시). 빈 검색어는 전부.
 */
export function filterPickableModels(
  models: readonly PickableModel[],
  query: string,
): PickableModel[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...models];
  const out: PickableModel[] = [];
  for (const model of models) {
    const modelMatched =
      model.equipName.toLowerCase().includes(needle) ||
      (model.craneId ?? '').toLowerCase().includes(needle);
    if (modelMatched) {
      out.push(model);
      continue;
    }
    const codes = model.codes.filter((c) =>
      c.code.toLowerCase().includes(needle),
    );
    if (codes.length > 0) out.push({ ...model, codes });
  }
  return out;
}

/** 시나리오에 이미 있는 태그의 선택 키 집합. */
export function existingPickKeys(
  scenario: Pick<SimulationScenario, 'tags'> | null,
): Set<string> {
  return new Set((scenario?.tags ?? []).map((t) => pickKey(t.modelId, t.code)));
}

/** 시나리오에 태그가 하나도 없는 모델만 — "모델 추가" 다이얼로그의 목록. */
export function filterModelsNotInScenario(
  models: readonly PickableModel[],
  scenario: Pick<SimulationScenario, 'tags'> | null,
): PickableModel[] {
  const inScenario = new Set((scenario?.tags ?? []).map((t) => t.modelId));
  return models.filter((m) => !inScenario.has(m.modelId));
}

/**
 * 묶음 태그 수정의 차집합 — 범위(`scopedKeys`, 다이얼로그에 보인 키) 안에서
 * 새로 체크한 키는 `addKeys`, 있었는데 푼 키는 `removeKeys`. 범위 밖의 기존
 * 태그(다른 모델·맵핑에서 사라진 코드)는 건드리지 않는다. 순서는 범위 순.
 */
export function diffPickSelection(
  selected: ReadonlySet<string>,
  existing: ReadonlySet<string>,
  scopedKeys: readonly string[],
): { addKeys: string[]; removeKeys: string[] } {
  const addKeys: string[] = [];
  const removeKeys: string[] = [];
  for (const key of scopedKeys) {
    const was = existing.has(key);
    const now = selected.has(key);
    if (now && !was) addKeys.push(key);
    else if (was && !now) removeKeys.push(key);
  }
  return { addKeys, removeKeys };
}

/**
 * 체크한 키를 시나리오 태그(id 없음)로 — 모델 순 › 코드 순. 기본값은
 * features `createScenarioTagDefaults`.
 */
export function buildScenarioTags(
  selected: ReadonlySet<string>,
  models: readonly PickableModel[],
): Omit<ScenarioTag, 'id'>[] {
  const out: Omit<ScenarioTag, 'id'>[] = [];
  for (const model of models) {
    for (const code of model.codes) {
      const key = pickKey(model.modelId, code.code);
      if (!selected.has(key)) continue;
      out.push({ ...createScenarioTagDefaults(code), modelId: model.modelId });
    }
  }
  return out;
}

/** 선택 요약 — 선택된 태그가 있는 모델 수·태그 수. */
export function countSelection(
  selected: ReadonlySet<string>,
  models: readonly PickableModel[],
): { models: number; tags: number } {
  let modelCount = 0;
  let tagCount = 0;
  for (const model of models) {
    let hit = 0;
    for (const code of model.codes) {
      if (selected.has(pickKey(model.modelId, code.code))) hit += 1;
    }
    if (hit > 0) {
      modelCount += 1;
      tagCount += hit;
    }
  }
  return { models: modelCount, tags: tagCount };
}
