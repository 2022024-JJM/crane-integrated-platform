import {
  collectModelTagCodes,
  type ModelTagCode,
  type SavedSceneInfo,
} from '@crane/domain/3d';
import {
  VIRTUAL_TAG_PERIOD_DEFAULT,
  type ScenarioTag,
  type SimulationScenario,
  type VirtualTagDataType,
  type VirtualTagDefinition,
  type VirtualTagPattern,
  type VirtualTagPatternKind,
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

/**
 * 목록 행의 현재값 자리에 무엇을 둘지. `none` 은 값이 나가지 않는 행(씬과
 * 어긋난 issue 또는 키 없음)이라 조작을 두지 않는다. 수동은 손으로 바꾸고
 * (숫자는 막대를 끌고, 불리언은 ON/OFF 를 누른다), 파형은 보기만 한다.
 */
export type ScenarioRowControl = 'none' | 'slider' | 'bar' | 'toggle' | 'pill';

export function resolveRowControl(
  row: Pick<ScenarioRow, 'tag' | 'key' | 'issue'>,
): ScenarioRowControl {
  if (row.issue || !row.key) return 'none';
  const manual = row.tag.pattern.kind === 'manual';
  if (row.tag.dataType === 'bool') return manual ? 'toggle' : 'pill';
  return manual ? 'slider' : 'bar';
}

/**
 * 동작을 바꿀 때의 새 패턴. 같은 종류면 같은 참조(no-op), 파형끼리는 주기를
 * 이어받고, 수동에서 파형으로 가면 기본 주기다. 구형파의 dutyPct 는 다른
 * 파형으로 가면 버린다.
 */
export function nextPattern(
  current: VirtualTagPattern,
  kind: VirtualTagPatternKind,
): VirtualTagPattern {
  if (current.kind === kind) return current;
  if (kind === 'manual') return { kind };
  const periodSec =
    current.kind === 'manual' ? VIRTUAL_TAG_PERIOD_DEFAULT : current.periodSec;
  return { kind, periodSec };
}

/**
 * 펼친 정의에 초기값 줄을 둘지. 초기값이 화면에서 뜻을 갖는 것은 사인·톱니파의
 * 시작 위상뿐이다(tag-pattern `phaseForInitial`). 수동은 목록 막대가 현재값을
 * 정하고, 구형파는 재생하면 초기값을 읽지 않는다 — 불리언(수동·구형파 뿐)은
 * 늘 숨는다.
 */
export function showsInitialValue(pattern: VirtualTagPattern): boolean {
  return pattern.kind === 'sine' || pattern.kind === 'sawtooth';
}

/** 주기 설명 문장의 i18n 키(`monitoring:scenario.sentence.*`). */
export type PatternSentenceKey =
  | 'sine'
  | 'sawtooth'
  | 'square'
  | 'squareDuty'
  | 'boolSquare'
  | 'boolSquareDuty';

export interface PatternSentence {
  key: PatternSentenceKey;
  /** 문장에 끼울 값 — 숫자는 `formatVirtualValue` 표기, unit 은 앞 공백 포함(없으면 빈 문자열). */
  values: {
    period: string;
    min: string;
    max: string;
    unit: string;
    duty: string;
  };
}

/** 구형파 기본 duty(%) — tag-pattern 의 기본값과 같다. */
const SQUARE_DUTY_DEFAULT = 50;

/**
 * 파형 동작을 한 문장으로 — "사인파, 20초에 한 번 0 ↔ 60 m 왕복." 의 키와 값.
 * 수동은 주기가 없어 null. 구형파는 duty 가 50 이 아니면 "반은" 대신 % 문장이고,
 * 불리언은 최소·최대 대신 ON/OFF 문장이다.
 */
export function describePatternSentence(
  tag: VirtualTagDefinition,
): PatternSentence | null {
  const pattern = tag.pattern;
  if (pattern.kind === 'manual') return null;
  const isBool = tag.dataType === 'bool';
  const unitText = isBool ? '' : (tag.unit ?? '').trim();
  const rawDuty = pattern.kind === 'square' ? pattern.dutyPct : undefined;
  const duty =
    rawDuty !== undefined && Number.isFinite(rawDuty)
      ? Math.min(100, Math.max(0, rawDuty))
      : SQUARE_DUTY_DEFAULT;
  const values = {
    period: formatVirtualValue(pattern.periodSec),
    min: formatVirtualValue(tag.min),
    max: formatVirtualValue(tag.max),
    unit: unitText ? ` ${unitText}` : '',
    duty: formatVirtualValue(duty),
  };
  if (pattern.kind !== 'square') return { key: pattern.kind, values };
  const half = duty === SQUARE_DUTY_DEFAULT;
  if (isBool) return { key: half ? 'boolSquare' : 'boolSquareDuty', values };
  return { key: half ? 'square' : 'squareDuty', values };
}

/** 노드 경로의 마지막 이름 — `[0]Goliath/[1]Trolley_01` → `Trolley_01`. 루트는 빈 문자열. */
export function nodeLeafName(path: string): string {
  if (!path) return '';
  const leaf = path.split('/').pop() ?? path;
  return leaf.replace(/^\[\d+\]/, '');
}
