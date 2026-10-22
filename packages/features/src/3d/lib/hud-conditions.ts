import type { SavedModelInfo } from '@crane/domain/3d';
import type { Alarm, AlarmSeverity } from '@crane/domain/alarm';
import type { SceneCollisionRecord } from '../model/use-scene-collision-store';
import type { ZoneHold, ZoneIntrusion } from '../model/use-scene-zone-store';
import type { LabelStateRecord } from './model-label-state';
import type { RuntimeStatusRecord } from './model-runtime-status';
import type { StatusSinceRecords } from './status-since';

/**
 * 관제 HUD 의 이상 조건 — 알람 스토어의 알람과 3D 화면이 스스로 아는 장비
 * 이상(고장·통신두절·Bypass·영역 침범·충돌)을 **크레인 기준 한 목록**으로
 * 합친다. HUD 의 "위험 n · 주의 m" 요약, 펼침 목록의 행, 위험 비네트가 전부
 * 이 결과 하나를 읽는다(model/use-hud-conditions.ts 가 스토어에서 모아 부른다).
 *
 * 등급은 둘뿐이다.
 * - 위험(danger): 충돌, stop 영역 침범, 고장, critical·high 알람
 * - 주의(caution): warn 영역 침범, 통신두절, medium 알람, Bypass
 * info 알람은 목록·요약 어디에도 넣지 않는다.
 *
 * 영역 침범은 알람 스토어의 로컬 알람(`zone_intrusion`)이 아니라 영역 스토어
 * 에서 직접 읽는다 — 정지 여부와 침입자가 알람에는 없다. 그래서 알람 쪽의
 * `zone_intrusion` 은 거른다(같은 사건이 두 줄 되지 않게). 영역 행은 **들어간
 * 쪽**(침입자) 크레인에 붙는다 — 소유 크레인은 가만히 있었다.
 *
 * 행은 크레인마다 하나다. 그 크레인의 조건 중 가장 심각한 것이 제목(primary),
 * 나머지가 상세(others)다. 정렬은 위험 → 주의, 같은 등급 안에서는 제목
 * 조건이 **최근에 생긴 것**이 먼저다(새 이상이 위로 올라온다). 요약 수는
 * 조건이 아니라 행의 수다.
 *
 * 통신두절 중인 장비의 Bypass 는 라벨 판정이 이미 끈다(수신이 없으면 비트가
 * 낡은 값) — 여기서 따로 거르지 않는다.
 */

export type HudConditionLevel = 'danger' | 'caution';

export type HudCondition =
  | { kind: 'collision'; level: 'danger'; since: number; otherName: string }
  | {
      kind: 'zone';
      level: HudConditionLevel;
      since: number;
      zoneKey: string;
      ownerName: string;
      zoneName: string;
      /** 이 쌍으로 값 생산이 멈춰 있다("자동정지됨"). */
      held: boolean;
    }
  | { kind: 'fault'; level: 'danger'; since: number }
  | { kind: 'offline'; level: 'caution'; since: number }
  | { kind: 'bypass'; level: 'caution'; since: number }
  | {
      kind: 'alarm';
      level: HudConditionLevel;
      since: number;
      /** 같은 등급의 활성 알람들 — 최신 먼저. */
      alarms: readonly Alarm[];
    };

export type HudConditionKind = HudCondition['kind'];

export interface HudConditionRow {
  /** 행 키 — 씬 모델 id, 씬에 없는 크레인의 알람은 `crane:<craneId>`. */
  key: string;
  /** [보기] 로 카메라를 보낼 모델. 씬에 없는 크레인이면 null. */
  modelId: string | null;
  name: string;
  level: HudConditionLevel;
  primary: HudCondition;
  others: readonly HudCondition[];
}

export interface HudConditionSummary {
  rows: readonly HudConditionRow[];
  /** 위험 행 수. */
  danger: number;
  /** 주의 행 수. */
  caution: number;
}

export const EMPTY_HUD_CONDITIONS: HudConditionSummary = Object.freeze({
  rows: Object.freeze([]) as readonly HudConditionRow[],
  danger: 0,
  caution: 0,
});

export type HudConditionModel = Pick<
  SavedModelInfo,
  'id' | 'equipName' | 'craneId'
>;

export interface HudConditionInputs {
  models: readonly HudConditionModel[];
  runtime: RuntimeStatusRecord;
  labels: LabelStateRecord;
  since: StatusSinceRecords;
  alarms: readonly Alarm[];
  intrusions: readonly ZoneIntrusion[];
  held: ZoneHold | null;
  /** 활성(pinned·flash) 충돌 기록. 없으면 null. */
  collision: Pick<SceneCollisionRecord, 'at' | 'a' | 'b'> | null;
}

/** 같은 등급 안의 제목 우선순위 — 작을수록 먼저. */
const KIND_PRIORITY: Record<HudConditionKind, number> = {
  collision: 0,
  zone: 1,
  fault: 2,
  alarm: 3,
  offline: 4,
  bypass: 5,
};

const LEVEL_ORDER: Record<HudConditionLevel, number> = {
  danger: 0,
  caution: 1,
};

/** 알람 심각도 → 등급. info 는 null(목록에 넣지 않음). */
export function alarmConditionLevel(
  severity: AlarmSeverity,
): HudConditionLevel | null {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'danger';
    case 'medium':
      return 'caution';
    default:
      return null;
  }
}

/** 시각을 모르는 조건은 가장 오래된 것으로 둔다 — 목록 맨 아래, 경과 표시 없음. */
const UNKNOWN_SINCE = Number.NEGATIVE_INFINITY;

function knownSince(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : UNKNOWN_SINCE;
}

function alarmAt(alarm: Alarm): number {
  return knownSince(Date.parse(alarm.timestamp));
}

function compareNewestFirst(a: number, b: number): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

/** 조건 심각도 비교 — 등급, 종류, 최근 순. */
function compareConditions(a: HudCondition, b: HudCondition): number {
  return (
    LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
    KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] ||
    compareNewestFirst(a.since, b.since)
  );
}

function compareRows(a: HudConditionRow, b: HudConditionRow): number {
  return (
    LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
    compareNewestFirst(a.primary.since, b.primary.since) ||
    KIND_PRIORITY[a.primary.kind] - KIND_PRIORITY[b.primary.kind] ||
    a.key.localeCompare(b.key)
  );
}

/** 영역 키 `modelId#zoneId` 의 소유 모델 id. */
function zoneOwnerId(zoneKey: string): string {
  const hash = zoneKey.indexOf('#');
  return hash >= 0 ? zoneKey.slice(0, hash) : zoneKey;
}

interface RowDraft {
  key: string;
  modelId: string | null;
  name: string;
  conditions: HudCondition[];
}

export function buildHudConditions(
  inputs: HudConditionInputs,
): HudConditionSummary {
  const drafts = new Map<string, RowDraft>();
  const modelById = new Map<string, HudConditionModel>();
  const modelByCraneId = new Map<string, HudConditionModel>();
  for (const model of inputs.models) {
    modelById.set(model.id, model);
    if (model.craneId && !modelByCraneId.has(model.craneId)) {
      modelByCraneId.set(model.craneId, model);
    }
  }

  const rowForModel = (modelId: string, fallbackName: string): RowDraft => {
    let draft = drafts.get(modelId);
    if (!draft) {
      const model = modelById.get(modelId);
      draft = {
        key: modelId,
        modelId: model ? modelId : null,
        name: model?.equipName || fallbackName || modelId,
        conditions: [],
      };
      drafts.set(modelId, draft);
    }
    return draft;
  };

  const rowForCrane = (craneId: string, craneName: string): RowDraft => {
    const model = modelByCraneId.get(craneId) ?? modelById.get(craneId);
    if (model) return rowForModel(model.id, craneName);
    const key = `crane:${craneId}`;
    let draft = drafts.get(key);
    if (!draft) {
      draft = {
        key,
        modelId: null,
        name: craneName || craneId,
        conditions: [],
      };
      drafts.set(key, draft);
    }
    return draft;
  };

  // 충돌 — 양쪽 장비 모두.
  if (inputs.collision) {
    const { at, a, b } = inputs.collision;
    const since = knownSince(at);
    rowForModel(a.modelId, a.equipName).conditions.push({
      kind: 'collision',
      level: 'danger',
      since,
      otherName: b.equipName,
    });
    if (b.modelId !== a.modelId) {
      rowForModel(b.modelId, b.equipName).conditions.push({
        kind: 'collision',
        level: 'danger',
        since,
        otherName: a.equipName,
      });
    }
  }

  // 영역 침범 — 들어간 쪽에. 영역↔영역이면 들어간 영역의 소유 모델에.
  for (const intrusion of inputs.intrusions) {
    const level: HudConditionLevel =
      intrusion.level === 'stop' ? 'danger' : 'caution';
    const since = knownSince(intrusion.at);
    const zoneName = intrusion.zoneName || intrusion.zoneId;
    for (const intruder of intrusion.intruders) {
      const intruderModelId =
        intruder.kind === 'model' ? intruder.id : zoneOwnerId(intruder.id);
      const held =
        inputs.held !== null &&
        inputs.held.zoneKey === intrusion.zoneKey &&
        inputs.held.intruderId === intruder.id;
      rowForModel(intruderModelId, intruder.name).conditions.push({
        kind: 'zone',
        level,
        since,
        zoneKey: intrusion.zoneKey,
        ownerName: intrusion.ownerName,
        zoneName,
        held,
      });
    }
  }

  // 운전 상태 — 고장·통신두절, 라벨의 Bypass.
  for (const model of inputs.models) {
    const tone = inputs.runtime[model.id];
    if (tone === 'fault') {
      rowForModel(model.id, model.equipName).conditions.push({
        kind: 'fault',
        level: 'danger',
        since: knownSince(inputs.since.tone[model.id]),
      });
    } else if (tone === 'offline') {
      rowForModel(model.id, model.equipName).conditions.push({
        kind: 'offline',
        level: 'caution',
        since: knownSince(inputs.since.tone[model.id]),
      });
    }
    if (inputs.labels[model.id]?.bypass) {
      rowForModel(model.id, model.equipName).conditions.push({
        kind: 'bypass',
        level: 'caution',
        since: knownSince(inputs.since.bypass[model.id]),
      });
    }
  }

  // 알람 — 크레인·등급별로 묶는다. 영역 침범 로컬 알람은 영역 스토어가 맡았다.
  const groups = new Map<
    string,
    { row: RowDraft; level: HudConditionLevel; alarms: Alarm[] }
  >();
  for (const alarm of inputs.alarms) {
    if (!alarm.active || alarm.eventType === 'zone_intrusion') continue;
    const level = alarmConditionLevel(alarm.severity);
    if (!level) continue;
    const row = rowForCrane(alarm.craneId, alarm.craneName);
    const groupKey = `${row.key}|${level}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = { row, level, alarms: [] };
      groups.set(groupKey, group);
    }
    group.alarms.push(alarm);
  }
  for (const { row, level, alarms } of groups.values()) {
    alarms.sort((a, b) => compareNewestFirst(alarmAt(a), alarmAt(b)));
    let since = Number.POSITIVE_INFINITY;
    for (const alarm of alarms) {
      const at = alarmAt(alarm);
      if (at !== UNKNOWN_SINCE && at < since) since = at;
    }
    row.conditions.push({
      kind: 'alarm',
      level,
      since: knownSince(since),
      alarms,
    });
  }

  const rows: HudConditionRow[] = [];
  for (const draft of drafts.values()) {
    const sorted = draft.conditions.slice().sort(compareConditions);
    const primary = sorted[0];
    if (!primary) continue;
    rows.push({
      key: draft.key,
      modelId: draft.modelId,
      name: draft.name,
      level: primary.level,
      primary,
      others: sorted.slice(1),
    });
  }
  if (rows.length === 0) return EMPTY_HUD_CONDITIONS;
  rows.sort(compareRows);
  let danger = 0;
  for (const row of rows) {
    if (row.level === 'danger') danger += 1;
  }
  return { rows, danger, caution: rows.length - danger };
}

/** 경과 표시 재료 — 1분 미만은 초, 1시간 미만은 분, 그 위는 시간. 문구는 i18n. */
export type HudElapsed = {
  unit: 'seconds' | 'minutes' | 'hours';
  value: number;
} | null;

export function resolveHudElapsed(since: number, now: number): HudElapsed {
  if (!Number.isFinite(since) || !Number.isFinite(now)) return null;
  const ms = Math.max(0, now - since);
  if (ms < 60_000) return { unit: 'seconds', value: Math.floor(ms / 1000) };
  if (ms < 3_600_000) {
    return { unit: 'minutes', value: Math.floor(ms / 60_000) };
  }
  return { unit: 'hours', value: Math.floor(ms / 3_600_000) };
}
