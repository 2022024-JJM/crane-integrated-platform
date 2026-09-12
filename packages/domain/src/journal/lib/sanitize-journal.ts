import type {
  AlarmJournalEntry,
  CollisionJournalEntry,
  CollisionJournalParty,
  StatusJournalEntry,
  ZoneJournalEntry,
} from '../model/types';

/**
 * journal 항목 방어 — localStorage 는 다른 탭·구버전·손상으로 무엇이든 담겨
 * 있을 수 있다. 항목 단위로 검사해 불량만 버린다(전체 폐기 아님). 유효한
 * 입력은 새 객체를 만들지 않고 **같은 참조**를 돌려준다 — 배열 검사도 전부
 * 유효하면 입력 배열 그대로다.
 */

const ALARM_SEVERITIES = new Set(['critical', 'high', 'medium', 'info']);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isParty(value: unknown): value is CollisionJournalParty {
  if (typeof value !== 'object' || value === null) return false;
  const party = value as Record<string, unknown>;
  return (
    typeof party.modelId === 'string' && typeof party.equipName === 'string'
  );
}

function isContactPoint(
  value: unknown,
): value is readonly [number, number, number] {
  return (
    Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber)
  );
}

export function sanitizeCollisionJournalEntry(
  raw: unknown,
): CollisionJournalEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(entry.key) ||
    !isFiniteNumber(entry.at) ||
    !isNonEmptyString(entry.pairKey) ||
    !(entry.regionId === null || isNonEmptyString(entry.regionId)) ||
    !isParty(entry.a) ||
    !isParty(entry.b) ||
    !isContactPoint(entry.contactPoint)
  ) {
    return null;
  }
  return raw as CollisionJournalEntry;
}

export function sanitizeAlarmJournalEntry(
  raw: unknown,
): AlarmJournalEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(entry.id) ||
    typeof entry.regionId !== 'string' ||
    typeof entry.craneId !== 'string' ||
    typeof entry.severity !== 'string' ||
    !ALARM_SEVERITIES.has(entry.severity) ||
    !isNonEmptyString(entry.timestamp) ||
    !(entry.alarmCode === null || typeof entry.alarmCode === 'string') ||
    !(entry.alarmName === null || typeof entry.alarmName === 'string') ||
    typeof entry.active !== 'boolean'
  ) {
    return null;
  }
  return raw as AlarmJournalEntry;
}

const ZONE_LEVELS = new Set(['warn', 'stop']);
const RUNTIME_STATUSES = new Set(['running', 'idle', 'offline', 'unknown']);

export function sanitizeZoneJournalEntry(
  raw: unknown,
): ZoneJournalEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(entry.key) ||
    !isFiniteNumber(entry.at) ||
    !(entry.kind === 'enter' || entry.kind === 'exit') ||
    !(entry.regionId === null || isNonEmptyString(entry.regionId)) ||
    !isNonEmptyString(entry.zoneKey) ||
    !isNonEmptyString(entry.ownerId) ||
    typeof entry.ownerName !== 'string' ||
    typeof entry.zoneName !== 'string' ||
    typeof entry.level !== 'string' ||
    !ZONE_LEVELS.has(entry.level) ||
    !isNonEmptyString(entry.intruderId) ||
    typeof entry.intruderName !== 'string' ||
    !(entry.durationMs === null || isFiniteNumber(entry.durationMs))
  ) {
    return null;
  }
  return raw as ZoneJournalEntry;
}

export function sanitizeStatusJournalEntry(
  raw: unknown,
): StatusJournalEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(entry.key) ||
    !isFiniteNumber(entry.at) ||
    typeof entry.regionId !== 'string' ||
    !isNonEmptyString(entry.modelId) ||
    typeof entry.equipName !== 'string' ||
    typeof entry.from !== 'string' ||
    !RUNTIME_STATUSES.has(entry.from) ||
    typeof entry.to !== 'string' ||
    !RUNTIME_STATUSES.has(entry.to)
  ) {
    return null;
  }
  return raw as StatusJournalEntry;
}
