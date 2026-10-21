import { describe, expect, it } from 'vitest';
import {
  TAG_HISTORY_WINDOW_MS,
  appendSample,
  historySamples,
  sparklinePoints,
} from '../tag-history';

describe('historySamples', () => {
  it('프레임에서 한 태그의 시각·값만 뽑는다 — boolean 은 0/1', () => {
    const out = historySamples(
      {
        frames: [
          { time: '2026-10-21T00:00:00Z', values: { a: 1, b: true } },
          { time: '2026-10-21T00:00:01Z', values: { a: 2, b: false } },
        ],
      },
      'b',
    );
    expect(out.map((s) => s.v)).toEqual([1, 0]);
    expect(out[1].t - out[0].t).toBe(1000);
  });

  it('없는 코드·숫자로 못 바꾸는 값·깨진 시각은 버리고, 비면 같은 빈 배열 참조', () => {
    const none = historySamples({ frames: [] }, 'a');
    expect(none).toEqual([]);
    expect(
      historySamples(
        {
          frames: [
            { time: 'not-a-date', values: { a: 1 } },
            { time: '2026-10-21T00:00:00Z', values: { a: 'x' as never } },
            { time: '2026-10-21T00:00:00Z', values: {} },
          ],
        },
        'a',
      ),
    ).toBe(none);
  });
});

describe('appendSample', () => {
  it('뒤에 붙이고 창 밖은 버린다 — 창 경계 정확값은 남고 그 이전은 빠진다', () => {
    const base = [
      { t: 0, v: 1 },
      { t: 1000, v: 2 },
    ];
    const next = appendSample(base, { t: TAG_HISTORY_WINDOW_MS + 1000, v: 3 });
    expect(next.map((s) => s.t)).toEqual([1000, TAG_HISTORY_WINDOW_MS + 1000]);
    const edge = appendSample([{ t: 0, v: 1 }], {
      t: TAG_HISTORY_WINDOW_MS,
      v: 2,
    });
    expect(edge).toHaveLength(2);
  });

  it('같은 시각이 끝에 있으면 값만 바꾼다', () => {
    const out = appendSample([{ t: 5, v: 1 }], { t: 5, v: 9 });
    expect(out).toEqual([{ t: 5, v: 9 }]);
  });

  it('창을 비우더라도 마지막 표본 하나는 남긴다, 비유한 표본은 무시(같은 참조)', () => {
    expect(appendSample([{ t: 0, v: 1 }], { t: 10 ** 9, v: 2 })).toEqual([
      { t: 10 ** 9, v: 2 },
    ]);
    const base = [{ t: 0, v: 1 }];
    expect(appendSample(base, { t: Number.NaN, v: 1 })).toBe(base);
    expect(appendSample(base, { t: 1, v: Number.POSITIVE_INFINITY })).toBe(
      base,
    );
  });

  it('입력 배열을 바꾸지 않는다', () => {
    const base = [{ t: 0, v: 1 }];
    appendSample(base, { t: 1, v: 2 });
    expect(base).toEqual([{ t: 0, v: 1 }]);
  });
});

describe('sparklinePoints', () => {
  it('시각을 가로, 값 범위를 세로 여백 안에 편다', () => {
    const points = sparklinePoints(
      [
        { t: 0, v: 0 },
        { t: 50, v: 10 },
        { t: 100, v: 5 },
      ],
      100,
      20,
      2,
    );
    expect(points).toBe('0.0,18.0 50.0,2.0 100.0,10.0');
  });

  it('빈 표본은 빈 문자열, 한 점은 가운데, 값이 전부 같으면 수평선', () => {
    expect(sparklinePoints([], 100, 20)).toBe('');
    expect(sparklinePoints([{ t: 3, v: 7 }], 100, 20)).toBe('50.0,10.0');
    expect(
      sparklinePoints(
        [
          { t: 0, v: 4 },
          { t: 10, v: 4 },
        ],
        100,
        20,
      ),
    ).toBe('0.0,10.0 100.0,10.0');
  });
});
