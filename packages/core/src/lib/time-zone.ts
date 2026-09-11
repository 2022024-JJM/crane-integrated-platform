/**
 * IANA 시간대 변환 — 라이브러리 없이 `Intl.DateTimeFormat` 으로 푼다.
 *
 * 현장(거제·필라델피아)의 **벽시계 시각**과 UTC epoch 를 오가야 하는 곳이
 * 3D 씬의 낮/밤(태양 위치) 계산이다. 태양 위치 자체는 UTC 로 계산하지만,
 * 사용자가 고르는 "현장 시각 14:30" 이나 리플레이 타임스탬프(현장 벽시계)
 * 는 시간대를 거쳐야 epoch 가 된다. 브라우저 로컬 시간대는 현장과 다를 수
 * 있어(한국에서 필리 조선소를 보는 경우) `Date` 의 로컬 메서드를 쓰지
 * 않는다.
 *
 * 폐쇄망 배포라 tz 데이터베이스가 든 라이브러리를 새로 들이지 않는다 —
 * `Intl` 은 브라우저·Node 에 내장이라 의존성이 0 이다.
 */

export interface ZonedTimeParts {
  year: number;
  /** 1~12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 자정부터 지난 분(0~1439). 시각 슬라이더가 쓴다. */
  minuteOfDay: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** 시간대 이름이 이 런타임의 Intl 에서 유효한지. 미지원이면 false. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/**
 * UTC epoch(ms) → 해당 시간대의 벽시계 구성요소. 유효하지 않은 시각·시간대는
 * null.
 */
export function getZonedTimeParts(
  utcMs: number,
  timeZone: string,
): ZonedTimeParts | null {
  if (!Number.isFinite(utcMs)) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = getFormatter(timeZone).formatToParts(new Date(utcMs));
  } catch {
    return null;
  }
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
  const year = read('year');
  const month = read('month');
  const day = read('day');
  // 일부 엔진은 hourCycle h23 에서도 자정을 "24" 로 낸다.
  const hour = read('hour') % 24;
  const minute = read('minute');
  const second = read('second');
  if (
    [year, month, day, hour, minute, second].some((v) => !Number.isFinite(v))
  ) {
    return null;
  }
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    minuteOfDay: hour * 60 + minute,
  };
}

/**
 * 시간대의 UTC 오프셋(ms). 동쪽이 양수(Asia/Seoul = +9h). DST 는 주어진
 * 시각 기준으로 반영된다.
 */
export function getTimeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = getZonedTimeParts(utcMs, timeZone);
  if (!parts) return 0;
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  // formatToParts 는 초 이하를 버리므로 입력도 초 단위로 내려 비교한다.
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * 시간대의 벽시계 구성요소 → UTC epoch(ms).
 *
 * 오프셋이 시각에 따라 달라지므로(DST) "벽시계를 UTC 로 가정한 값" 에서
 * 오프셋을 빼고 그 결과로 오프셋을 한 번 더 구해 수렴시킨다. DST 전환
 * 틈(존재하지 않는 시각)은 두 번째 오프셋 기준으로 해석되어 항상 유효한
 * epoch 를 돌려준다.
 */
export function zonedWallTimeToUtc(
  wall: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  },
  timeZone: string,
): number {
  const guess = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour ?? 0,
    wall.minute ?? 0,
    wall.second ?? 0,
  );
  const first = guess - getTimeZoneOffsetMs(guess, timeZone);
  return guess - getTimeZoneOffsetMs(first, timeZone);
}

/**
 * 어떤 시각이 속한 현장 날짜의 특정 벽시계 분(minuteOfDay)에 해당하는
 * UTC epoch. 시각 슬라이더가 "오늘 14:30" 을 만들 때 쓴다.
 */
export function setZonedMinuteOfDay(
  utcMs: number,
  minuteOfDay: number,
  timeZone: string,
): number {
  const parts = getZonedTimeParts(utcMs, timeZone);
  if (!parts) return utcMs;
  const clamped = Math.min(1439, Math.max(0, Math.round(minuteOfDay)));
  return zonedWallTimeToUtc(
    {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: Math.floor(clamped / 60),
      minute: clamped % 60,
    },
    timeZone,
  );
}

/** 현장 날짜의 자정(00:00) UTC epoch. 일출·일몰 탐색의 시작점. */
export function startOfZonedDay(utcMs: number, timeZone: string): number {
  return setZonedMinuteOfDay(utcMs, 0, timeZone);
}
