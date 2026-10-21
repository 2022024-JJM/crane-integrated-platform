import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPLAY_DURATION,
  DEFAULT_REPLAY_RANGE_MS,
  REPLAY_DURATIONS_MS,
  REPLAY_DURATION_KEYS,
  buildDefaultReplayFormValues,
  buildDefaultReplayQuery,
  buildDefaultReplayStart,
  fromDateTimeLocalValue,
  getReplayStartMax,
  isReplayDuration,
  parseDateTimeLocalValue,
  resolveReplayRange,
  toDateTimeLocalValue,
  toIsoString,
  validateReplayStart,
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

describe('조회 길이', () => {
  it('선택지는 10분·30분·1시간 순이고 기본은 10분', () => {
    expect(REPLAY_DURATION_KEYS).toEqual(['10m', '30m', '1h']);
    expect(DEFAULT_REPLAY_DURATION).toBe('10m');
    expect(DEFAULT_REPLAY_RANGE_MS).toBe(REPLAY_DURATIONS_MS['10m']);
    expect(REPLAY_DURATIONS_MS['1h']).toBe(60 * 60 * 1000);
  });

  it('isReplayDuration 은 선택지 키만 통과시킨다', () => {
    expect(isReplayDuration('30m')).toBe(true);
    expect(isReplayDuration('2h')).toBe(false);
    expect(isReplayDuration(10)).toBe(false);
    expect(isReplayDuration(undefined)).toBe(false);
    expect(isReplayDuration('toString')).toBe(false);
  });
});

describe('buildDefaultReplayStart / Query / FormValues', () => {
  it('기본 시작은 직전 정각(로컬)에서 한 시간 전 — 11:39:05 → 10:00:00', () => {
    const start = buildDefaultReplayStart(new Date(2026, 9, 21, 11, 39, 5));
    expect(start.getTime()).toBe(new Date(2026, 9, 21, 10, 0, 0).getTime());
  });

  it('정각이어도 한 시간 전이고, 자정 직후는 전날로 넘어간다', () => {
    expect(
      buildDefaultReplayStart(new Date(2026, 9, 21, 11, 0, 0)).getTime(),
    ).toBe(new Date(2026, 9, 21, 10, 0, 0).getTime());
    expect(
      buildDefaultReplayStart(new Date(2026, 9, 21, 0, 20, 0)).getTime(),
    ).toBe(new Date(2026, 9, 20, 23, 0, 0).getTime());
  });

  it('기본 구간은 기본 시작부터 기본 길이만큼', () => {
    const now = new Date(2026, 9, 21, 11, 39, 5);
    const query = buildDefaultReplayQuery('dock-1', now);
    expect(query.from).toBe(toIsoString(new Date(2026, 9, 21, 10, 0, 0)));
    expect(query.to).toBe(
      toIsoString(
        new Date(
          new Date(2026, 9, 21, 10, 0, 0).getTime() + DEFAULT_REPLAY_RANGE_MS,
        ),
      ),
    );
    expect(query.craneIds).toContain('C_171');
  });

  it('폼 기본값은 시작(로컬 정각)과 기본 길이', () => {
    const now = new Date(2026, 9, 21, 11, 39, 5);
    const form = buildDefaultReplayFormValues('dock-1', now);
    expect(form.start).toBe('2026-10-21T10:00:00');
    expect(form.duration).toBe(DEFAULT_REPLAY_DURATION);
    // 기본 구간(10:00~10:10)은 지금(11:39)보다 전이라 잘리지 않는다.
    expect(resolveReplayRange(form.start, form.duration, now)).toEqual({
      from: toIsoString(new Date(2026, 9, 21, 10, 0, 0)),
      to: toIsoString(new Date(2026, 9, 21, 10, 10, 0)),
    });
  });

  it('가장 긴 길이(1h)를 골라도 기본 시작이면 지금을 넘지 않는다', () => {
    const now = new Date(2026, 9, 21, 11, 0, 0);
    const form = buildDefaultReplayFormValues('dock-1', now);
    expect(resolveReplayRange(form.start, '1h', now)?.to).toBe(
      toIsoString(now),
    );
  });
});

describe('resolveReplayRange', () => {
  /** 지금 — 조회 구간보다 충분히 뒤. */
  const LATER = new Date(2026, 9, 22, 0, 0, 0);

  it('시작 + 길이를 ISO(UTC) 로 돌려준다', () => {
    const start = '2026-10-21T09:00:00';
    const from = fromDateTimeLocalValue(start);
    const fromMs = new Date(from).getTime();
    expect(resolveReplayRange(start, '10m', LATER)).toEqual({
      from,
      to: toIsoString(new Date(fromMs + 10 * 60 * 1000)),
    });
    expect(resolveReplayRange(start, '1h', LATER)?.to).toBe(
      toIsoString(new Date(fromMs + 60 * 60 * 1000)),
    );
  });

  it('종료가 지금을 넘으면 지금(초 단위)으로 자른다', () => {
    const now = new Date(2026, 9, 21, 9, 3, 20, 750);
    expect(resolveReplayRange('2026-10-21T09:00:00', '10m', now)).toEqual({
      from: toIsoString(new Date(2026, 9, 21, 9, 0, 0)),
      to: toIsoString(new Date(2026, 9, 21, 9, 3, 20)),
    });
  });

  it('종료가 정확히 지금이면 그대로 — 경계값', () => {
    const now = new Date(2026, 9, 21, 9, 10, 0);
    expect(resolveReplayRange('2026-10-21T09:00:00', '10m', now)?.to).toBe(
      toIsoString(now),
    );
  });

  it('시작이 지금 이후이거나 같은 초면 null — 조회할 구간이 없다', () => {
    const now = new Date(2026, 9, 21, 9, 0, 0, 900);
    expect(resolveReplayRange('2026-10-21T09:00:00', '10m', now)).toBeNull();
    expect(resolveReplayRange('2026-10-21T09:30:00', '10m', now)).toBeNull();
    // 1초 앞서면 1초짜리 구간이 된다.
    expect(resolveReplayRange('2026-10-21T08:59:59', '10m', now)).toEqual({
      from: toIsoString(new Date(2026, 9, 21, 8, 59, 59)),
      to: toIsoString(new Date(2026, 9, 21, 9, 0, 0)),
    });
  });

  it('시작을 못 읽으면 null', () => {
    expect(resolveReplayRange('', '10m', LATER)).toBeNull();
    expect(resolveReplayRange('garbage', '10m', LATER)).toBeNull();
    expect(resolveReplayRange('2026-10-21T09:00:00Z', '10m', LATER)).toBeNull();
  });
});

describe('validateReplayStart', () => {
  const NOW = new Date(2026, 9, 21, 11, 39, 5, 400);

  it('빈 값은 missing, 못 읽는 값은 invalid, 과거면 통과', () => {
    expect(validateReplayStart('', NOW)).toEqual({
      isValid: false,
      reason: 'missing',
    });
    expect(validateReplayStart('nope', NOW)).toEqual({
      isValid: false,
      reason: 'invalid',
    });
    expect(validateReplayStart('2026-10-21T09:00', NOW)).toEqual({
      isValid: true,
      reason: null,
    });
  });

  it('지금 이후는 future — 같은 초는 거부, 1초 전은 통과', () => {
    expect(validateReplayStart('2026-10-21T11:40:00', NOW)).toEqual({
      isValid: false,
      reason: 'future',
    });
    expect(validateReplayStart('2026-10-21T11:39:05', NOW)).toEqual({
      isValid: false,
      reason: 'future',
    });
    expect(validateReplayStart('2026-10-21T11:39:04', NOW)).toEqual({
      isValid: true,
      reason: null,
    });
  });
});

describe('getReplayStartMax', () => {
  it('지금을 datetime-local 로 준다', () => {
    expect(getReplayStartMax(new Date(2026, 9, 21, 11, 39, 5))).toBe(
      '2026-10-21T11:39:05',
    );
  });
});
