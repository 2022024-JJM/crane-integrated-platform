import {
  CRANE_SCOPES,
  type CraneScope,
  type CraneSnapshot,
  type CraneSnapshotBatch,
  type CraneSnapshotTag,
} from '../model/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

export function isCraneScope(value: unknown): value is CraneScope {
  return (CRANE_SCOPES as readonly unknown[]).includes(value);
}

/**
 * 태그 항목 — 값은 숫자·불리언 또는 null(서버가 값 없음을 null 로 보낸다).
 * null 도 태그로 남겨야 화면이 "값 없음" 을 보일 수 있다.
 */
export function isCraneSnapshotTag(value: unknown): value is CraneSnapshotTag {
  if (!isRecord(value)) return false;
  const tagValue = value.value;
  return (
    (typeof tagValue === 'number' ||
      typeof tagValue === 'boolean' ||
      tagValue === null) &&
    typeof value.quality === 'number' &&
    isNullableString(value.timestamp)
  );
}

/**
 * 서버 `CraneSnapshot` JSON 방어 — 필드 하나라도 어긋나면 통째로 버린다.
 * 태그 맵은 항목마다 검사하되, 깨진 태그 하나 때문에 크레인 전체를 잃지
 * 않도록 호출자가 `sanitizeCraneSnapshot` 으로 깨진 태그만 걸러 쓸 수 있다.
 * `scope` 는 없어도 되지만(옛 JSON — indoor 로 읽는다) 있으면 아는 값이어야 한다.
 */
export function isCraneSnapshot(
  value: unknown,
): value is Omit<CraneSnapshot, 'scope'> & { scope?: CraneScope } {
  if (!isRecord(value)) return false;
  return (
    typeof value.craneId === 'string' &&
    value.craneId.length > 0 &&
    (value.scope === undefined || isCraneScope(value.scope)) &&
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
    scope: value.scope ?? 'indoor',
    stationId: value.stationId,
    bay: value.bay,
    snapshotAt: value.snapshotAt,
    lastReceivedAt: value.lastReceivedAt,
    online: value.online,
    tags,
  };
}

/** `/topic/{scope}/cranes` 봉투 — `{ type: 'snapshot', sentAt, cranes: [...] }`. */
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

const CRANE_ID_NUMBER = /^(.*?)(\d+)\s*$/;

/**
 * 크레인 ID 정렬 — 끝 숫자 앞의 접두어(GC_·TTC_·C_)로 묶고 그 안에서 끝의
 * 숫자(C_171 → 171) 오름차순. `C_1806` 이 `C_800` 뒤에 오고(사전순이면 앞에
 * 온다) 외업의 GC_01·OC_01·TTC_01 이 섞이지 않는다. 숫자가 없는 ID 는 숫자
 * 있는 ID 뒤, 남은 동률은 문자열 비교.
 */
export function compareCraneIds(a: string, b: string): number {
  const na = CRANE_ID_NUMBER.exec(a);
  const nb = CRANE_ID_NUMBER.exec(b);
  if (na && nb) {
    const prefixDiff = na[1].localeCompare(nb[1]);
    if (prefixDiff !== 0) return prefixDiff;
    const diff = Number(na[2]) - Number(nb[2]);
    if (diff !== 0) return diff;
  } else if (na !== nb) {
    // 숫자 있는 쪽을 앞에
    return na ? -1 : 1;
  }
  return a.localeCompare(b);
}
