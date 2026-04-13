type ReplayTimestampFormat = 'datetime' | 'time';

const REPLAY_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?Z?$/;

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

  const [, year, month, day, hour, minute, second = '00'] = match;

  if (format === 'time') {
    return `${hour}:${minute}:${second}`;
  }

  return `${year}.${month}.${day} ${hour}:${minute}:${second}`;
}
