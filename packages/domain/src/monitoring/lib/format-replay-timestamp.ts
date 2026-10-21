type ReplayTimestampFormat = 'datetime' | 'time';

const REPLAY_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z)?$/;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/**
 * 리플레이 시각 표시 — `YYYY.MM.DD HH:mm:ss` 또는 `HH:mm:ss`.
 *
 * 끝에 `Z` 가 있으면(서버 이력·조회 구간의 ISO UTC) 브라우저 로컬 시간으로
 * 바꿔 보인다 — 검색 폼의 datetime-local 값과 같은 기준이라 구간 라벨과
 * 프레임 위치가 같은 시계로 읽힌다. `Z` 가 없으면 벽시계 값으로 보고 숫자를
 * 그대로 쓴다. 형식이 다르면 입력 그대로 돌려준다.
 */
export function formatReplayTimestamp(
  value: string | null,
  format: ReplayTimestampFormat = 'datetime',
) {
  if (!value) {
    return null;
  }

  const match = value.match(REPLAY_TIMESTAMP_PATTERN);

  if (!match) {
    return value;
  }

  const [, y, mo, d, h, mi, s = '00', zulu] = match;
  let year = y;
  let month = mo;
  let day = d;
  let hour = h;
  let minute = mi;
  let second = s;

  if (zulu) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      year = String(date.getFullYear());
      month = pad(date.getMonth() + 1);
      day = pad(date.getDate());
      hour = pad(date.getHours());
      minute = pad(date.getMinutes());
      second = pad(date.getSeconds());
    }
  }

  if (format === 'time') {
    return `${hour}:${minute}:${second}`;
  }

  return `${year}.${month}.${day} ${hour}:${minute}:${second}`;
}
