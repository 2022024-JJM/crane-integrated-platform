import { describe, expect, it } from 'vitest';
import { formatReplayTimestamp } from '../format-replay-timestamp';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

describe('formatReplayTimestamp', () => {
  it('Z 가 붙은 ISO(UTC)는 브라우저 로컬 시간으로 바꿔 보인다', () => {
    const iso = '2026-10-21T01:18:53Z';
    const local = new Date(iso);
    const expectedDate = `${local.getFullYear()}.${pad(local.getMonth() + 1)}.${pad(local.getDate())}`;
    const expectedTime = `${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
    expect(formatReplayTimestamp(iso, 'datetime')).toBe(
      `${expectedDate} ${expectedTime}`,
    );
    expect(formatReplayTimestamp(iso, 'time')).toBe(expectedTime);
    expect(formatReplayTimestamp('2026-10-21T01:18:53.140Z', 'time')).toBe(
      expectedTime,
    );
  });

  it('Z 가 없는 벽시계 값은 숫자를 그대로 쓰고 초가 없으면 00 으로 채운다', () => {
    expect(formatReplayTimestamp('2026-10-21T10:18:53', 'datetime')).toBe(
      '2026.10.21 10:18:53',
    );
    expect(formatReplayTimestamp('2026-10-21T10:18', 'time')).toBe('10:18:00');
  });

  it('빈 값은 null, 형식이 다르면 입력 그대로', () => {
    expect(formatReplayTimestamp(null)).toBeNull();
    expect(formatReplayTimestamp('')).toBeNull();
    expect(formatReplayTimestamp('garbage')).toBe('garbage');
    expect(formatReplayTimestamp('2026-10-21')).toBe('2026-10-21');
  });
});
