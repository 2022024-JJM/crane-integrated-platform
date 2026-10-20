import type {
  CraneSnapshot,
  CraneSnapshotBatch,
  CraneSnapshotTag,
} from '../model/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

export function isCraneSnapshotTag(value: unknown): value is CraneSnapshotTag {
  if (!isRecord(value)) return false;
  const tagValue = value.value;
  return (
    (typeof tagValue === 'number' || typeof tagValue === 'boolean') &&
    typeof value.quality === 'number' &&
    isNullableString(value.timestamp)
  );
}

/**
 * 서버 `CraneSnapshot` JSON 방어 — 필드 하나라도 어긋나면 통째로 버린다.
 * 태그 맵은 항목마다 검사하되, 깨진 태그 하나 때문에 크레인 전체를 잃지
 * 않도록 호출자가 `sanitizeCraneSnapshot` 으로 깨진 태그만 걸러 쓸 수 있다.
 */
export function isCraneSnapshot(value: unknown): value is CraneSnapshot {
  if (!isRecord(value)) return false;
  return (
    typeof value.craneId === 'string' &&
    value.craneId.length > 0 &&
    isNullableString(value.stationId) &&
    isNullableString(value.bay) &&
    isNullableString(value.snapshotAt) &&
    isNullableString(value.lastReceivedAt) &&
    typeof value.online === 'boolean' &&
    isRecord(value.tags)
  );
}

/**
 * 스냅샷을 받아들이되 모양이 깨진 태그 항목만 떨어뜨린다. 스냅샷 자체가
 * 아니면 null.
 */
export function sanitizeCraneSnapshot(value: unknown): CraneSnapshot | null {
  if (!isCraneSnapshot(value)) return null;
  const tags: Record<string, CraneSnapshotTag> = {};
  for (const [code, tag] of Object.entries(value.tags)) {
    if (isCraneSnapshotTag(tag)) tags[code] = tag;
  }
  return {
    craneId: value.craneId,
    stationId: value.stationId,
    bay: value.bay,
    snapshotAt: value.snapshotAt,
    lastReceivedAt: value.lastReceivedAt,
    online: value.online,
    tags,
  };
}

/** `/topic/cranes` 봉투 — `{ type: 'snapshot', sentAt, cranes: [...] }`. */
export function isCraneSnapshotBatch(
  value: unknown,
): value is CraneSnapshotBatch {
  if (!isRecord(value)) return false;
  return (
    value.type === 'snapshot' &&
    isNullableString(value.sentAt) &&
    Array.isArray(value.cranes)
  );
}

/** ISO 시각 → epoch ms. 없거나 못 읽으면 null. */
export function parseIsoMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

const CRANE_ID_NUMBER = /(\d+)\s*$/;

/**
 * 크레인 ID 정렬 — 끝의 숫자(C_171 → 171)로 오름차순, 숫자가 없거나 같으면
 * 문자열 비교. `C_1806` 이 `C_800` 뒤에 오게 한다(사전순이면 앞에 온다).
 */
export function compareCraneIds(a: string, b: string): number {
  const na = CRANE_ID_NUMBER.exec(a);
  const nb = CRANE_ID_NUMBER.exec(b);
  if (na && nb) {
    const diff = Number(na[1]) - Number(nb[1]);
    if (diff !== 0) return diff;
  } else if (na !== nb) {
    // 숫자 있는 쪽을 앞에
    return na ? -1 : 1;
  }
  return a.localeCompare(b);
}
