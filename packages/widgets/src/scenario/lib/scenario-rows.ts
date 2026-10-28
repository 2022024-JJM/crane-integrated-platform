import {
  collectModelTagCodes,
  type ModelTagCode,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import type {
  ScenarioTag,
  SimulationScenario,
  VirtualTagDataType,
} from '@crane/domain/virtual-tag';
import type {
  ScenarioTagIssue,
  ScenarioTagIssueReason,
  VirtualTagEntry,
} from '@crane/features/3d';

/**
 * 시나리오 패널의 순수 로직 — ui/*.tsx 안에서 계산하지 않는다는 규칙
 * (AGENTS.md) 대로 여기서 묶고 적는다.
 */

/** 행 하나 — 태그 정의 + 씬에서 풀린 키(없으면 issue) + 맵핑 대상. */
export interface ScenarioRow {
  tag: ScenarioTag;
  /** 러너가 쓰는 키. issue 가 있으면 없다. */
  key: string | undefined;
  issue: ScenarioTagIssueReason | undefined;
  /** 이 코드가 모델에서 가리키는 것(노드·채널·축 / 관절 / 상태 역할). 맵핑이 없어졌으면 없다. */
  target: ModelTagCode | undefined;
}

/** 모델 묶음 — 씬에 없는 모델은 `present: false`(이름은 id). */
export interface ScenarioModelGroup {
  modelId: string;
  modelName: string;
  craneId: string | undefined;
  present: boolean;
  rows: ScenarioRow[];
  /** issue 가 있는 행 수 — 접힌 머리줄이 경고를 보이는 근거. */
  issueCount: number;
}

/**
 * 시나리오 태그를 모델별로 묶는다 — 시나리오의 태그 순서를 지키고, 모델은
 * 처음 등장한 순서. 키·issue 는 스토어가 씬으로 편 결과(entries·issues)에서
 * 찾는다.
 */
export function groupScenarioRows(
  scenario: SimulationScenario | null,
  sceneInfo: SavedSceneInfo | null,
  entries: readonly VirtualTagEntry[],
  issues: readonly ScenarioTagIssue[],
): ScenarioModelGroup[] {
  if (!scenario) return [];
  const keyByTagId = new Map(entries.map((e) => [e.tag.id, e.key]));
  const issueByTagId = new Map(issues.map((i) => [i.tagId, i.reason]));
  const modelsById = new Map(
    (sceneInfo?.models ?? []).map((m) => [m.id, m] as const),
  );
  const codesByModel = new Map<string, ModelTagCode[]>();
  const groups = new Map<string, ScenarioModelGroup>();
  for (const tag of scenario.tags) {
    let group = groups.get(tag.modelId);
    if (!group) {
      const model = modelsById.get(tag.modelId);
      group = {
        modelId: tag.modelId,
        modelName: model?.equipName || tag.modelId,
        craneId: model?.craneId,
        present: model !== undefined,
        rows: [],
        issueCount: 0,
      };
      groups.set(tag.modelId, group);
      if (model) codesByModel.set(tag.modelId, collectModelTagCodes(model));
    }
    const issue = issueByTagId.get(tag.id);
    if (issue) group.issueCount += 1;
    group.rows.push({
      tag,
      key: keyByTagId.get(tag.id),
      issue,
      target: codesByModel.get(tag.modelId)?.find((c) => c.code === tag.code),
    });
  }
  return [...groups.values()];
}

/** 현재값 표기 — 소수 셋째 자리까지, 꼬리 0 제거. 없으면 대시. */
export function formatVirtualValue(
  value: number | undefined,
  dataType: VirtualTagDataType = 'number',
): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (dataType === 'bool') return value >= 0.5 ? '1' : '0';
  return Number(value.toFixed(3)).toString();
}

/** 값의 범위 안 위치(0~100). 범위가 없거나 값이 없으면 0. */
export function valuePercent(
  value: number | undefined,
  min: number,
  max: number,
): number {
  const range = max - min;
  if (value === undefined || !Number.isFinite(value) || range <= 0) return 0;
  return Math.min(100, Math.max(0, ((value - min) / range) * 100));
}

/** 수동 슬라이더의 step — 범위를 200 칸으로. 범위가 없으면 1. */
export function sliderStep(min: number, max: number): number {
  const range = max - min;
  return range > 0 ? range / 200 : 1;
}

/** 불리언 값이 켜진 것으로 보이는가(0.5 문턱). */
export function isBoolOn(value: number | undefined): boolean {
  return value !== undefined && value >= 0.5;
}

/** 노드 경로의 마지막 이름 — `[0]Goliath/[1]Trolley_01` → `Trolley_01`. 루트는 빈 문자열. */
export function nodeLeafName(path: string): string {
  if (!path) return '';
  const leaf = path.split('/').pop() ?? path;
  return leaf.replace(/^\[\d+\]/, '');
}
