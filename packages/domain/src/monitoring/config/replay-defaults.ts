import { getCraneIdsByRegion } from '../../shared';

/** 이력 프레임 간격 — 서버 `step`. 1h 상한에서 721 프레임이다. */
const DEFAULT_REPLAY_INTERVAL = '5s';
/** 서버 `cis.query.max-range` 와 같다. */
const MAX_REPLAY_RANGE_MS = 60 * 60 * 1000;
/** 검색 폼 기본 구간 — 지금까지 최근 10분. */
export const DEFAULT_REPLAY_RANGE_MS = 10 * 60 * 1000;

const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function padDateTimeSegment(value: number) {
  return String(value).padStart(2, '0');
}

/**
 * datetime-local 입력값(`YYYY-MM-DDTHH:mm[:ss]`, 브라우저 로컬 시간) → Date.
 * 형식이 다르거나 날짜가 아니면 null.
 */
export function parseDateTimeLocalValue(value: string): Date | null {
  const match = value.trim().match(DATE_TIME_LOCAL_PATTERN);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '0'] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → ISO-8601 UTC, 초 단위(`2026-10-21T00:15:30Z`). 서버 `from`/`to` 형식. */
export function toIsoString(value: Date) {
  return value.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Date 또는 ISO 문자열 → datetime-local 입력값(브라우저 로컬 시간, 초 포함).
 * 읽을 수 없는 값은 빈 문자열.
 */
export function toDateTimeLocalValue(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    padDateTimeSegment(date.getMonth() + 1),
    padDateTimeSegment(date.getDate()),
  ]
    .join('-')
    .concat(
      `T${padDateTimeSegment(date.getHours())}:${padDateTimeSegment(
        date.getMinutes(),
      )}:${padDateTimeSegment(date.getSeconds())}`,
    );
}

/**
 * datetime-local 입력값 → 서버 ISO(UTC). 형식이 다르면 빈 문자열이라 조회가
 * 나가지 않는다.
 */
export function fromDateTimeLocalValue(value: string) {
  const date = parseDateTimeLocalValue(value);
  return date ? toIsoString(date) : '';
}

export function getReplayDefaultCraneIds(regionId: string) {
  return getCraneIdsByRegion(regionId);
}

export function getDefaultReplayInterval() {
  return DEFAULT_REPLAY_INTERVAL;
}

/** 기본 조회 구간 — `now` 까지 최근 `DEFAULT_REPLAY_RANGE_MS`. 초 아래는 버린다. */
export function buildDefaultReplayQuery(
  regionId: string,
  now: Date = new Date(),
) {
  const to = new Date(Math.floor(now.getTime() / 1000) * 1000);
  const from = new Date(to.getTime() - DEFAULT_REPLAY_RANGE_MS);
  return {
    from: toIsoString(from),
    to: toIsoString(to),
    craneIds: getReplayDefaultCraneIds(regionId),
  };
}

export function buildDefaultReplayFormValues(regionId: string, now?: Date) {
  const query = buildDefaultReplayQuery(regionId, now);

  return {
    from: toDateTimeLocalValue(query.from),
    to: toDateTimeLocalValue(query.to),
    craneIds: query.craneIds,
  };
}

export type ReplayValidationReason =
  | 'missing'
  | 'invalid'
  | 'order'
  | 'tooLarge';

/** 검색 폼 값 검증. 서버는 `from < to`, 구간 ≤ 1h 를 요구한다. */
export function validateReplayDateTimeRange(from: string, to: string) {
  if (!from || !to) {
    return { isValid: false, reason: 'missing' as const };
  }

  const parsedFrom = parseDateTimeLocalValue(from);
  const parsedTo = parseDateTimeLocalValue(to);

  if (!parsedFrom || !parsedTo) {
    return { isValid: false, reason: 'invalid' as const };
  }

  if (parsedFrom.getTime() >= parsedTo.getTime()) {
    return { isValid: false, reason: 'order' as const };
  }

  if (parsedTo.getTime() - parsedFrom.getTime() > MAX_REPLAY_RANGE_MS) {
    return { isValid: false, reason: 'tooLarge' as const };
  }

  return { isValid: true, reason: null };
}

export interface MonitoringReplayUiState {
  draftFrom: string;
  draftTo: string;
  setDraftFrom: (v: string) => void;
  setDraftTo: (v: string) => void;
  submitSearch: () => void;
  canSearch: boolean;
  validationReason: ReplayValidationReason | null | undefined;
  viewingFrom: string;
  viewingTo: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
}
