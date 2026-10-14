import type {
  EquipmentLabelState,
  EquipmentRuntimeStatus,
} from '@crane/core/types/status';
import {
  STATUS_TAG_ROLES,
  type ModelStatusTags,
  type SavedModelInfo,
  type StatusTagRole,
} from '@crane/domain/3d';
import {
  DEFAULT_STATUS_WINDOWS,
  collectModelTagKeys,
  resolveTagActivity,
  type RuntimeStatusWindows,
  type TagActivity,
} from './model-runtime-status';

/**
 * 장비의 운전 상태 판정 — 태그 활동(lib/model-runtime-status.ts)에 모델의 상태
 * 태그(`statusTags`)를 더해 여섯 가지 중 하나를 낸다. 라벨의 상자 색(tone)이
 * 곧 운전 상태라, 라벨·HUD·리포트·저널이 같은 값을 본다. 적용은
 * model/use-model-runtime-statuses.ts.
 *
 * 우선순위(위에서부터 먼저 맞는 것):
 * 1. unknown · offline — 수신이 없으면 상태 비트도 낡은 값이라 아이콘까지 끈다.
 * 2. fault — 고장 비트 on.
 * 3. off — 운전 전원 off. 움직임보다 앞이라 전원이 꺼진 장비의 센서 흔들림이
 *    가동으로 뜨지 않는다.
 * 4. running — 축 태그 값이 moving 창 안에 변했다.
 * 5. standby — 운전 전원 on.
 * 6. unknown — 수신은 되지만 운전 전원을 모른다(상태 태그가 없거나 아직 못
 *    받음). 멈춘 장비가 켜져 있는지 꺼져 있는지 알 수 없어 상태를 짓지 않는다.
 *    아이콘(Bypass·Free Swing)은 값을 알면 그린다.
 *
 * 미리보기(`LabelStatePreview`)는 에디터에서 값을 골라 라벨 모양을 확인하는
 * 용도다 — 같은 우선순위(2~6)를 타되 값은 버스가 아니라 고른 값에서 온다.
 */

/** 상태 비트의 on 문턱. 0/1 로 오지만 보간된 중간값(시나리오 linear)도 가른다. */
export const STATUS_BIT_ON_THRESHOLD = 0.5;

export interface TagReading extends TagActivity {
  value: number;
}

/** 모델 하나의 판정 입력 — 씬이 바뀔 때만 다시 만든다. */
export interface ModelStatusKeys {
  /** 움직임 판정 키(tagMappings). */
  motion: string[];
  /** 수신 판정 키 — 움직임 키 + 상태 태그 키. */
  liveness: string[];
  status: ModelStatusTags;
}

export function collectModelStatusKeys(
  model: Pick<SavedModelInfo, 'tagMappings' | 'statusTags'>,
): ModelStatusKeys {
  const motion = collectModelTagKeys(model);
  const liveness = [...motion];
  const seen = new Set(motion);
  const status: ModelStatusTags = {};
  for (const role of STATUS_TAG_ROLES) {
    const key = model.statusTags?.[role];
    if (typeof key !== 'string' || key.length === 0) continue;
    status[role] = key;
    if (seen.has(key)) continue;
    seen.add(key);
    liveness.push(key);
  }
  return { motion, liveness, status };
}

/** 비트 값 — 키가 없거나 아직 못 받았거나 값이 유한수가 아니면 null(모름). */
export function readStatusBit(
  key: string | undefined,
  get: (key: string) => TagReading | undefined,
): boolean | null {
  if (!key) return null;
  const reading = get(key);
  if (!reading || !Number.isFinite(reading.value)) return null;
  return reading.value >= STATUS_BIT_ON_THRESHOLD;
}

/**
 * 같은 내용이면 같은 객체 — 조합이 적어(tone × 아이콘 둘) 한 번 만든 것을 계속
 * 돌려준다. 라벨(memo 컴포넌트)에 prop 으로 내려가므로 판정마다 새 객체를
 * 만들면 상태가 그대로여도 전 모델이 리렌더된다.
 */
const LABEL_STATES = new Map<string, EquipmentLabelState>();

export function getLabelState(
  tone: EquipmentRuntimeStatus,
  bypass = false,
  freeSwing = false,
): EquipmentLabelState {
  const key = `${tone}|${bypass ? 1 : 0}|${freeSwing ? 1 : 0}`;
  let state = LABEL_STATES.get(key);
  if (!state) {
    state = Object.freeze({ tone, bypass, freeSwing });
    LABEL_STATES.set(key, state);
  }
  return state;
}

/** 상태를 모르는 라벨 — 기본 색, 아이콘 없음. */
export const UNKNOWN_LABEL_STATE = getLabelState('unknown');

/** 수신 중인 장비의 판정 입력 — 비트의 null 은 "모름". */
interface LabelInputs {
  moving: boolean;
  bits: Partial<Record<StatusTagRole, boolean | null>>;
}

/**
 * 우선순위 2~6 — 실제 값과 미리보기가 같은 규칙을 탄다. 운전 전원을 모르는
 * 멈춘 장비에 따로 색을 두지 않는다 — ACMS 의 Crane ID Box 에 없는 상태다.
 */
function toLabelState({ moving, bits }: LabelInputs): EquipmentLabelState {
  const tone: EquipmentRuntimeStatus =
    bits.fault === true
      ? 'fault'
      : bits.controlOn === false
        ? 'off'
        : moving
          ? 'running'
          : bits.controlOn === true
            ? 'standby'
            : 'unknown';
  return getLabelState(tone, bits.bypass === true, bits.freeSwing === true);
}

export function resolveLabelState(
  keys: ModelStatusKeys,
  get: (key: string) => TagReading | undefined,
  now: number,
  windows: RuntimeStatusWindows = DEFAULT_STATUS_WINDOWS,
): EquipmentLabelState {
  const activity = resolveTagActivity(
    keys.motion,
    get,
    now,
    windows,
    keys.liveness,
  );
  if (activity === 'unknown' || activity === 'offline') {
    return getLabelState(activity);
  }
  const bits: LabelInputs['bits'] = {};
  for (const role of STATUS_TAG_ROLES) {
    bits[role] = readStatusBit(keys.status[role], get);
  }
  return toLabelState({ moving: activity === 'moving', bits });
}

/**
 * 미리보기 값 — 에디터에서 고른 역할별 비트와 움직임. 고르지 않은 항목은 키가
 * 없다("모름"). 씬 데이터가 아니라 저장되지 않는다.
 */
export interface LabelStatePreview {
  bits: Partial<Record<StatusTagRole, boolean>>;
  moving?: boolean;
}

export const EMPTY_LABEL_PREVIEW: LabelStatePreview = Object.freeze({
  bits: Object.freeze({}),
});

export function isEmptyLabelPreview(preview: LabelStatePreview): boolean {
  return preview.moving === undefined && Object.keys(preview.bits).length === 0;
}

/**
 * 역할 하나의 미리보기 값을 바꾼 새 미리보기. null 은 그 역할을 뗀다. 바뀌는
 * 것이 없으면 같은 참조를 돌려준다.
 */
export function setPreviewBit(
  preview: LabelStatePreview,
  role: StatusTagRole,
  value: boolean | null,
): LabelStatePreview {
  if ((preview.bits[role] ?? null) === value) return preview;
  const bits = { ...preview.bits };
  delete bits[role];
  if (value !== null) bits[role] = value;
  return { ...preview, bits };
}

/** 움직임의 미리보기 값을 바꾼 새 미리보기 — 규칙은 `setPreviewBit` 과 같다. */
export function setPreviewMoving(
  preview: LabelStatePreview,
  value: boolean | null,
): LabelStatePreview {
  if ((preview.moving ?? null) === value) return preview;
  const next: LabelStatePreview = { bits: preview.bits };
  if (value !== null) next.moving = value;
  return next;
}

/**
 * 미리보기 → 표시 상태. 고른 값이 하나도 없으면 null(미리보기 없음). 하나라도
 * 고르면 "값이 오고 있다"고 보므로 offline 은 나오지 않는다. 운전 전원을
 * 고르지 않고 움직임도 없으면 색 없는 unknown 에 아이콘만 붙는다.
 */
export function resolvePreviewLabelState(
  preview: LabelStatePreview,
): EquipmentLabelState | null {
  if (isEmptyLabelPreview(preview)) return null;
  return toLabelState({ moving: preview.moving === true, bits: preview.bits });
}

export type LabelStateRecord = Readonly<Record<string, EquipmentLabelState>>;

/** 두 표시 상태 기록이 같은 내용인지 — 훅이 참조를 유지할지 판단한다. */
export function isSameLabelStateRecord(
  a: LabelStateRecord,
  b: LabelStateRecord,
): boolean {
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    const left = a[key];
    const right = b[key];
    if (!right) return false;
    if (
      left.tone !== right.tone ||
      left.bypass !== right.bypass ||
      left.freeSwing !== right.freeSwing
    ) {
      return false;
    }
  }
  return true;
}
