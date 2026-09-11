import { zonedWallTimeToUtc } from '@crane/core/lib/time-zone';

/**
 * 리플레이 프레임 타임스탬프 → UTC epoch(ms). 3D 리플레이의 낮/밤(태양
 * 위치)이 프레임 시각을 따라가는 데 쓴다.
 *
 * 형식은 format-replay-timestamp 와 같은 `YYYY-MM-DDTHH:mm[:ss[.fff]][Z]`.
 * 끝에 `Z` 가 있으면 UTC 고, 없으면 **현장 벽시계**로 해석해 시간대로
 * 변환한다 — `Date.parse` 에 그대로 넘기면 브라우저 로컬 시간대로 읽혀
 * 한국에서 필리 리플레이를 볼 때 13시간이 어긋난다. 형식이 다르면 null.
 */
const PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(Z)?$/;

export function parseReplayTimestamp(
  value: string | null | undefined,
  timeZone: string,
): number | null {
  if (!value) return null;
  const match = value.match(PATTERN);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '0', fraction, zulu] =
    match;
  const wall = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  const ms = fraction ? Math.round(Number(`0.${fraction}`) * 1000) : 0;
  const base = zulu
    ? Date.UTC(
        wall.year,
        wall.month - 1,
        wall.day,
        wall.hour,
        wall.minute,
        wall.second,
      )
    : zonedWallTimeToUtc(wall, timeZone);
  return Number.isFinite(base) ? base + ms : null;
}
