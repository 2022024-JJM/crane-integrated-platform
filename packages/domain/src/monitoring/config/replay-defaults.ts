import { getCraneIdsByRegion } from '../../shared';

/** 이력 프레임 간격 — 서버 `step`(최소 1s). 1h 상한에서 3601 프레임, 서버 max-points 5000 안이다. */
const DEFAULT_REPLAY_INTERVAL = '1s';

/** 조회 길이 선택지. 가장 긴 1h 가 서버 `cis.query.max-range` 와 같다. */
export const REPLAY_DURATIONS_MS = {
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
} as const;

export type ReplayDuration = keyof typeof REPLAY_DURATIONS_MS;

/** 선택지 순서 — 폼의 토글 순서다. */
export const REPLAY_DURATION_KEYS = Object.keys(
  REPLAY_DURATIONS_MS,
) as ReplayDuration[];

export const DEFAULT_REPLAY_DURATION: ReplayDuration = '10m';

/** 검색 폼 기본 구간 길이. */
export const DEFAULT_REPLAY_RANGE_MS =
  REPLAY_DURATIONS_MS[DEFAULT_REPLAY_DURATION];

const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function padDateTimeSegment(value: number) {
  return String(value).padStart(2, '0');
}

export function isReplayDuration(value: unknown): value is ReplayDuration {
  return typeof value === 'string' && Object.hasOwn(REPLAY_DURATIONS_MS, value);
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

/**
 * 기본 시작 시각 — `now` 의 직전 정각(브라우저 로컬)에서 한 시간 전. 11:39 이면
 * 10:00:00 이다. 정각이라 눈금이 깔끔하고, 한 시간을 빼야 가장 긴 길이(1h)로도
 * 아직 오지 않은 시각을 조회하지 않는다.
 */
export function buildDefaultReplayStart(now: Date = new Date()) {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() - 1);
  return start;
}

/** 기본 조회 구간 — 기본 시작 시각부터 `DEFAULT_REPLAY_RANGE_MS` 만큼. */
export function buildDefaultReplayQuery(
  regionId: string,
  now: Date = new Date(),
) {
  const from = buildDefaultReplayStart(now);
  const to = new Date(from.getTime() + DEFAULT_REPLAY_RANGE_MS);
  return {
    from: toIsoString(from),
    to: toIsoString(to),
    craneIds: getReplayDefaultCraneIds(regionId),
  };
}

/** 검색 폼 기본값 — 시작은 직전 정각 한 시간 전(datetime-local), 길이는 기본값. */
export function buildDefaultReplayFormValues(regionId: string, now?: Date) {
  const query = buildDefaultReplayQuery(regionId, now);

  return {
    start: toDateTimeLocalValue(query.from),
    duration: DEFAULT_REPLAY_DURATION,
    craneIds: query.craneIds,
  };
}

export type ReplayValidationReason = 'missing' | 'invalid' | 'future';

/**
 * 조회 끝의 상한 — 지금을 초 단위로 내린 값. 서버 `from`/`to` 가 초 단위라
 * 같은 초 안의 시작은 종료와 같아져 400 이 된다. 그래서 시작은 이 값보다
 * 엄격히 앞서야 한다.
 */
function replayNowMs(now: Date) {
  return Math.floor(now.getTime() / 1000) * 1000;
}

/**
 * 시작 시각 검증 — 비었거나(missing) 못 읽거나(invalid) 지금 이후(future)면
 * 거부한다. 종료는 시작 + 길이를 지금으로 자르므로 순서·길이 오류는 없다.
 */
export function validateReplayStart(start: string, now: Date = new Date()) {
  if (!start) {
    return { isValid: false, reason: 'missing' as const };
  }
  const date = parseDateTimeLocalValue(start);
  if (!date) {
    return { isValid: false, reason: 'invalid' as const };
  }
  if (date.getTime() >= replayNowMs(now)) {
    return { isValid: false, reason: 'future' as const };
  }
  return { isValid: true, reason: null };
}

/**
 * 시작(datetime-local) + 길이 → 서버 `from`/`to`(ISO UTC). 종료는 지금을 넘지
 * 않게 자른다 — 아직 오지 않은 시각은 조회하지 않는다(서버는 저장 행이 없어도
 * 직전 값으로 프레임을 채워 돌려주므로 미래를 "데이터 있음" 으로 착각한다).
 * 시작을 못 읽거나 지금 이후면 null.
 */
export function resolveReplayRange(
  start: string,
  duration: ReplayDuration,
  now: Date = new Date(),
): { from: string; to: string } | null {
  const date = parseDateTimeLocalValue(start);
  if (!date) return null;
  const nowMs = replayNowMs(now);
  if (date.getTime() >= nowMs) return null;
  const endMs = Math.min(date.getTime() + REPLAY_DURATIONS_MS[duration], nowMs);
  return {
    from: toIsoString(date),
    to: toIsoString(new Date(endMs)),
  };
}

/** 달력에서 고를 수 있는 마지막 시각 — 지금(datetime-local). 그 뒤 날짜는 막힌다. */
export function getReplayStartMax(now: Date = new Date()) {
  return toDateTimeLocalValue(now);
}

export interface MonitoringReplayUiState {
  /** 시작 시각 입력값(datetime-local). */
  draftStart: string;
  setDraftStart: (value: string) => void;
  /** 시작 입력을 기본값(`buildDefaultReplayStart`, 누르는 순간 기준)으로 되돌린다. */
  resetDraftStart: () => void;
  /** 시작 + 길이(지금에서 자름)로 계산한 종료 시각(datetime-local). 조회할 수 없으면 빈 값. */
  draftEnd: string;
  duration: ReplayDuration;
  setDuration: (value: ReplayDuration) => void;
  durations: readonly ReplayDuration[];
  submitSearch: () => void;
  canSearch: boolean;
  validationReason: ReplayValidationReason | null | undefined;
  /** 지금 보고 있는 구간(datetime-local). */
  viewingFrom: string;
  viewingTo: string;
  isLoading: boolean;
  isError: boolean;
  /** 조회는 성공했지만 구간에 프레임이 하나도 없음. */
  isEmpty: boolean;
  errorMessage: string | null;
}
