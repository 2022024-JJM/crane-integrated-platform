import type {
  EquipmentOutlineState,
  EquipmentRuntimeStatus,
} from '@crane/core/types/status';
import {
  OUTLINE_STATUS_TAG_ROLES,
  type ModelStatusTags,
  type OutlineStatusTagRole,
} from '@crane/domain/3d';
import {
  isEmptyLabelPreview,
  readStatusBit,
  type LabelStatePreview,
  type TagReading,
} from './model-label-state';

/**
 * 장비 외곽선 판정 — 모델의 상태 태그(`statusTags`)에서 통신불량·Slowdown·
 * Endstop 비트를 읽어 ACMS 의 외곽선 네 가지 중 하나를 낸다. 라벨의 색과는
 * 독립이라 가동 중인 장비도 외곽선이 생긴다. 적용은
 * model/use-model-runtime-statuses.ts, 그리기는 domain 의 GltfModel.
 *
 * 우선순위(위에서부터 먼저 맞는 것):
 * 1. commError — 수신이 끊겼다(운전 상태 offline). 비트가 전부 낡은 값이라
 *    Slowdown·Endstop 을 읽지 않는다(라벨이 아이콘을 끄는 것과 같은 규칙).
 * 2. commError — 통신불량 비트 on. 서버는 값을 주고 있지만 장비의 지금 상태가
 *    아니라서 같은 이유로 Slowdown·Endstop 보다 앞선다.
 * 3. endstop — Endstop 비트 on.
 * 4. slowdown — Slowdown 비트 on.
 * 5. none — 그 외. 받은 적이 없는 장비도 여기다(비트를 모른다).
 *
 * 수신 끊김은 라벨 판정(lib/model-label-state.ts)의 결과를 그대로 받는다 —
 * 따로 판정하면 회색 외곽선 수와 통신두절 라벨 수가 어긋난다.
 */

type OutlineBits = Partial<Record<OutlineStatusTagRole, boolean | null>>;

function toOutlineState(bits: OutlineBits): EquipmentOutlineState {
  if (bits.commError === true) return 'commError';
  if (bits.endstop === true) return 'endstop';
  if (bits.slowdown === true) return 'slowdown';
  return 'none';
}

export function resolveOutlineState(
  tone: EquipmentRuntimeStatus,
  status: ModelStatusTags,
  get: (key: string) => TagReading | undefined,
): EquipmentOutlineState {
  if (tone === 'offline') return 'commError';
  const bits: OutlineBits = {};
  for (const role of OUTLINE_STATUS_TAG_ROLES) {
    bits[role] = readStatusBit(status[role], get);
  }
  return toOutlineState(bits);
}

/**
 * 미리보기 → 외곽선. 고른 값이 하나도 없으면 null(미리보기 없음). 하나라도
 * 고르면 "값이 오고 있다"고 보므로 수신 끊김은 나오지 않고, 회색은 통신불량
 * 값을 On 으로 골랐을 때만 나온다.
 */
export function resolvePreviewOutlineState(
  preview: LabelStatePreview,
): EquipmentOutlineState | null {
  if (isEmptyLabelPreview(preview)) return null;
  return toOutlineState(preview.bits);
}

export type OutlineStateRecord = Readonly<
  Record<string, EquipmentOutlineState>
>;

/** 두 외곽선 기록이 같은 내용인지 — 훅이 참조를 유지할지 판단한다. */
export function isSameOutlineStateRecord(
  a: OutlineStateRecord,
  b: OutlineStateRecord,
): boolean {
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
