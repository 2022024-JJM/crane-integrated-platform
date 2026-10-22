import { describe, expect, it } from 'vitest';
import { EMPTY_SINCE, bypassOnRecord, trackSince } from '../status-since';

describe('trackSince', () => {
  it('새 키는 now, 값이 그대로면 이전 시각과 참조를 유지한다', () => {
    const first = trackSince(EMPTY_SINCE, {}, { a: 'x', b: 'y' }, 100);
    expect(first).toEqual({ a: 100, b: 100 });
    const second = trackSince(
      first,
      { a: 'x', b: 'y' },
      { a: 'x', b: 'y' },
      200,
    );
    expect(second).toBe(first);
  });

  it('값이 바뀐 키만 now 로 리셋된다', () => {
    const first = trackSince(EMPTY_SINCE, {}, { a: 'x', b: 'y' }, 100);
    const next = trackSince(first, { a: 'x', b: 'y' }, { a: 'z', b: 'y' }, 200);
    expect(next).toEqual({ a: 200, b: 100 });
    expect(next).not.toBe(first);
  });

  it('이번 값에 없는 키는 지우고 참조가 바뀐다', () => {
    const first = trackSince(EMPTY_SINCE, {}, { a: 'x', b: 'y' }, 100);
    const next = trackSince(first, { a: 'x', b: 'y' }, { a: 'x' }, 200);
    expect(next).toEqual({ a: 100 });
    expect(next).not.toBe(first);
  });

  it('키가 빠졌다 돌아오면 새 시각이다', () => {
    const first = trackSince(EMPTY_SINCE, {}, { a: 'x' }, 100);
    const gone = trackSince(first, { a: 'x' }, {}, 200);
    expect(gone).toEqual({});
    const back = trackSince(gone, {}, { a: 'x' }, 300);
    expect(back).toEqual({ a: 300 });
  });

  it('이전 시각이 없는데 값만 같아도 now 다 — 기록 불일치 방어', () => {
    expect(trackSince(EMPTY_SINCE, { a: 'x' }, { a: 'x' }, 50)).toEqual({
      a: 50,
    });
  });

  it('빈 값에 빈 기록이면 같은 참조', () => {
    expect(trackSince(EMPTY_SINCE, {}, {}, 1)).toBe(EMPTY_SINCE);
  });
});

describe('bypassOnRecord', () => {
  it('켜진 모델만 on 으로 남긴다', () => {
    expect(
      bypassOnRecord({ a: { bypass: true }, b: { bypass: false } }),
    ).toEqual({ a: 'on' });
    expect(bypassOnRecord({})).toEqual({});
  });
});
