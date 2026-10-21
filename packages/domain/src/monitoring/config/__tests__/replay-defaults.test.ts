import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPLAY_RANGE_MS,
  buildDefaultReplayFormValues,
  buildDefaultReplayQuery,
  fromDateTimeLocalValue,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
  toIsoString,
  validateReplayDateTimeRange,
} from '../replay-defaults';

describe('datetime-local ↔ ISO', () => {
  it('datetime-local 값은 브라우저 로컬 시간으로 읽는다 — 초 생략 가능, 앞뒤 공백 무시', () => {
    expect(parseDateTimeLocalValue('2026-10-21T09:05')?.getTime()).toBe(
      new Date(2026, 9, 21, 9, 5, 0).getTime(),
    );
    expect(parseDateTimeLocalValue(' 2026-10-21T09:05:07 ')?.getTime()).toBe(
      new Date(2026, 9, 21, 9, 5, 7).getTime(),
    );
  });

  it('형식이 다르면 null — ISO(Z)·날짜만·빈 값·쓰레기', () => {
    expect(parseDateTimeLocalValue('2026-10-21T09:05:00Z')).toBeNull();
    expect(parseDateTimeLocalValue('2026-10-21')).toBeNull();
    expect(parseDateTimeLocalValue('')).toBeNull();
    expect(parseDateTimeLocalValue('garbage')).toBeNull();
  });

  it('로컬 → ISO(UTC) → 로컬 왕복이 같은 값으로 돌아온다', () => {
    const local = '2026-10-21T09:05:07';
    const iso = fromDateTimeLocalValue(local);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(toDateTimeLocalValue(iso)).toBe(local);
  });

  it('ISO 는 초 단위로 자르고, 못 읽는 값은 빈 문자열', () => {
    expect(toIsoString(new Date(Date.UTC(2026, 9, 21, 0, 15, 30, 999)))).toBe(
      '2026-10-21T00:15:30Z',
    );
    expect(fromDateTimeLocalValue('garbage')).toBe('');
    expect(toDateTimeLocalValue('garbage')).toBe('');
  });
});

describe('buildDefaultReplayQuery', () => {
  it('now 까지 최근 DEFAULT_REPLAY_RANGE_MS, 초 아래는 버린다', () => {
    const now = new Date(Date.UTC(2026, 9, 21, 0, 15, 30, 999));
    const query = buildDefaultReplayQuery('dock-1', now);
    expect(query.to).toBe('2026-10-21T00:15:30Z');
    expect(query.from).toBe(
      toIsoString(
        new Date(Date.UTC(2026, 9, 21, 0, 15, 30) - DEFAULT_REPLAY_RANGE_MS),
      ),
    );
    expect(query.craneIds).toContain('C_171');
  });

  it('폼 값은 같은 구간을 로컬 시간으로 보여 준다', () => {
    const now = new Date(Date.UTC(2026, 9, 21, 0, 15, 30));
    const form = buildDefaultReplayFormValues('dock-1', now);
    expect(fromDateTimeLocalValue(form.to)).toBe('2026-10-21T00:15:30Z');
    expect(
      new Date(fromDateTimeLocalValue(form.to)).getTime() -
        new Date(fromDateTimeLocalValue(form.from)).getTime(),
    ).toBe(DEFAULT_REPLAY_RANGE_MS);
  });
});

describe('validateReplayDateTimeRange', () => {
  it('빈 값은 missing, 못 읽는 값은 invalid', () => {
    expect(validateReplayDateTimeRange('', '2026-10-21T09:00')).toEqual({
      isValid: false,
      reason: 'missing',
    });
    expect(validateReplayDateTimeRange('nope', '2026-10-21T09:00')).toEqual({
      isValid: false,
      reason: 'invalid',
    });
  });

  it('from 이 to 보다 늦거나 같으면 order — 서버가 from < to 를 요구한다', () => {
    expect(
      validateReplayDateTimeRange('2026-10-21T09:00', '2026-10-21T08:59'),
    ).toEqual({ isValid: false, reason: 'order' });
    expect(
      validateReplayDateTimeRange('2026-10-21T09:00', '2026-10-21T09:00'),
    ).toEqual({ isValid: false, reason: 'order' });
  });

  it('정확히 1시간은 통과, 1초 넘으면 tooLarge', () => {
    expect(
      validateReplayDateTimeRange('2026-10-21T09:00:00', '2026-10-21T10:00:00'),
    ).toEqual({ isValid: true, reason: null });
    expect(
      validateReplayDateTimeRange('2026-10-21T09:00:00', '2026-10-21T10:00:01'),
    ).toEqual({ isValid: false, reason: 'tooLarge' });
  });
});
