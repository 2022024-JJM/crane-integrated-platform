import { describe, expect, it } from 'vitest';
import type { CraneHistoryFrames } from '../../model/types';
import {
  buildReplayFromCraneHistories,
  sanitizeCraneHistoryFrames,
} from '../crane-history';

function response(overrides: Record<string, unknown> = {}) {
  return {
    craneId: 'C_171',
    from: '2026-10-21T00:00:00Z',
    to: '2026-10-21T00:00:10Z',
    step: 'PT5S',
    tags: ['a', 'b'],
    baseline: { time: '2026-10-20T23:59:59.140Z', values: { a: 1, b: true } },
    frames: [
      { time: '2026-10-21T00:00:00Z', values: { a: 1, b: true } },
      { time: '2026-10-21T00:00:05Z', values: { a: 2, b: false } },
      { time: '2026-10-21T00:00:10Z', values: { a: 3, b: false } },
    ],
    truncated: false,
    ...overrides,
  };
}

function history(
  craneId: string,
  frames: Array<[string, Record<string, number | boolean>]>,
): CraneHistoryFrames {
  return {
    craneId,
    from: '2026-10-21T00:00:00Z',
    to: '2026-10-21T00:00:10Z',
    step: 'PT5S',
    tags: [],
    baseline: null,
    frames: frames.map(([time, values]) => ({ time, values })),
    truncated: false,
  };
}

const QUERY = { from: '2026-10-21T00:00:00Z', to: '2026-10-21T00:00:10Z' };

describe('sanitizeCraneHistoryFrames', () => {
  it('정상 응답은 그대로 받는다', () => {
    const result = sanitizeCraneHistoryFrames(response());
    expect(result).toEqual(response());
  });

  it('객체가 아니거나 craneId·from·to·frames 가 어긋나면 null', () => {
    expect(sanitizeCraneHistoryFrames(null)).toBeNull();
    expect(sanitizeCraneHistoryFrames('text')).toBeNull();
    expect(sanitizeCraneHistoryFrames([])).toBeNull();
    expect(sanitizeCraneHistoryFrames(response({ craneId: '' }))).toBeNull();
    expect(sanitizeCraneHistoryFrames(response({ craneId: 7 }))).toBeNull();
    expect(sanitizeCraneHistoryFrames(response({ from: null }))).toBeNull();
    expect(sanitizeCraneHistoryFrames(response({ to: undefined }))).toBeNull();
    expect(sanitizeCraneHistoryFrames(response({ frames: {} }))).toBeNull();
  });

  it('깨진 프레임은 버리고 값은 유한한 숫자·불리언만 남긴다', () => {
    const result = sanitizeCraneHistoryFrames(
      response({
        frames: [
          { time: '2026-10-21T00:00:00Z', values: { a: 1 } },
          { time: 5, values: { a: 1 } },
          { time: '2026-10-21T00:00:05Z', values: 'nope' },
          null,
          {
            time: '2026-10-21T00:00:10Z',
            values: {
              ok: 2,
              bit: false,
              text: 'ON',
              nan: Number.NaN,
              inf: Number.POSITIVE_INFINITY,
              none: null,
              nested: { a: 1 },
            },
          },
        ],
      }),
    );
    expect(result?.frames).toEqual([
      { time: '2026-10-21T00:00:00Z', values: { a: 1 } },
      { time: '2026-10-21T00:00:10Z', values: { ok: 2, bit: false } },
    ]);
  });

  it('baseline 은 없거나 깨지면 null, tags 는 문자열만, step 은 문자열이 아니면 빈 값, truncated 는 true 만 참', () => {
    expect(
      sanitizeCraneHistoryFrames(response({ baseline: undefined }))?.baseline,
    ).toBeNull();
    expect(
      sanitizeCraneHistoryFrames(response({ baseline: null }))?.baseline,
    ).toBeNull();
    expect(
      sanitizeCraneHistoryFrames(response({ baseline: { time: 1 } }))?.baseline,
    ).toBeNull();
    const loose = sanitizeCraneHistoryFrames(
      response({ tags: ['a', 1, null], step: 5, truncated: 'yes' }),
    );
    expect(loose?.tags).toEqual(['a']);
    expect(loose?.step).toBe('');
    expect(loose?.truncated).toBe(false);
    expect(sanitizeCraneHistoryFrames(response({ tags: 'a' }))?.tags).toEqual(
      [],
    );
  });
});

describe('buildReplayFromCraneHistories', () => {
  it('같은 시각의 크레인 프레임을 한 장으로 묶고 시각순으로 정렬한다', () => {
    const result = buildReplayFromCraneHistories(
      [
        history('C_171', [
          ['2026-10-21T00:00:05Z', { a: 2 }],
          ['2026-10-21T00:00:00Z', { a: 1 }],
        ]),
        history('C_172', [
          ['2026-10-21T00:00:00Z', { a: 10, bit: true }],
          ['2026-10-21T00:00:05Z', { a: 20, bit: false }],
        ]),
      ],
      QUERY,
    );
    expect(result.from).toBe(QUERY.from);
    expect(result.to).toBe(QUERY.to);
    expect(result.craneIds).toEqual(['C_171', 'C_172']);
    expect(result.frames).toEqual([
      {
        timestamp: '2026-10-21T00:00:00Z',
        cranes: [
          {
            craneId: 'C_171',
            craneNo: 'C-171',
            snapshotAt: '2026-10-21T00:00:00Z',
            values: { a: 1 },
          },
          {
            craneId: 'C_172',
            craneNo: 'C-172',
            snapshotAt: '2026-10-21T00:00:00Z',
            values: { a: 10, bit: true },
          },
        ],
      },
      {
        timestamp: '2026-10-21T00:00:05Z',
        cranes: [
          {
            craneId: 'C_171',
            craneNo: 'C-171',
            snapshotAt: '2026-10-21T00:00:05Z',
            values: { a: 2 },
          },
          {
            craneId: 'C_172',
            craneNo: 'C-172',
            snapshotAt: '2026-10-21T00:00:05Z',
            values: { a: 20, bit: false },
          },
        ],
      },
    ]);
  });

  it('먼저 끝난(truncated) 크레인은 그 뒤 프레임에서 빠진다', () => {
    const result = buildReplayFromCraneHistories(
      [
        history('C_171', [
          ['2026-10-21T00:00:00Z', { a: 1 }],
          ['2026-10-21T00:00:05Z', { a: 2 }],
          ['2026-10-21T00:00:10Z', { a: 3 }],
        ]),
        history('C_172', [['2026-10-21T00:00:00Z', { a: 10 }]]),
      ],
      QUERY,
    );
    expect(result.frames.map((frame) => frame.cranes.length)).toEqual([
      2, 1, 1,
    ]);
    expect(result.frames[2]?.cranes[0]?.craneId).toBe('C_171');
  });

  it('값이 하나도 없는 프레임의 크레인은 넣지 않고, 크레인이 비는 프레임은 만들지 않는다', () => {
    const result = buildReplayFromCraneHistories(
      [
        history('C_171', [
          ['2026-10-21T00:00:00Z', {}],
          ['2026-10-21T00:00:05Z', { a: 1 }],
        ]),
        history('C_172', [
          ['2026-10-21T00:00:00Z', {}],
          ['2026-10-21T00:00:05Z', {}],
        ]),
      ],
      QUERY,
    );
    expect(result.craneIds).toEqual(['C_171', 'C_172']);
    expect(result.frames).toEqual([
      {
        timestamp: '2026-10-21T00:00:05Z',
        cranes: [
          {
            craneId: 'C_171',
            craneNo: 'C-171',
            snapshotAt: '2026-10-21T00:00:05Z',
            values: { a: 1 },
          },
        ],
      },
    ]);
  });

  it('레지스트리에 없는 크레인은 craneNo 에 craneId 를 쓴다', () => {
    const result = buildReplayFromCraneHistories(
      [history('X_9', [['2026-10-21T00:00:00Z', { a: 1 }]])],
      QUERY,
    );
    expect(result.frames[0]?.cranes[0]?.craneNo).toBe('X_9');
  });

  it('시각은 문자열이 아니라 시각값으로 정렬하고, 못 읽는 시각은 문자열 비교로 떨어진다', () => {
    const result = buildReplayFromCraneHistories(
      [
        history('C_171', [
          ['2026-10-21T00:00:05Z', { a: 3 }],
          ['2026-10-21T00:00:00.500Z', { a: 2 }],
          ['2026-10-21T00:00:00Z', { a: 1 }],
          ['garbage', { a: 0 }],
        ]),
      ],
      QUERY,
    );
    expect(result.frames.map((frame) => frame.timestamp)).toEqual([
      '2026-10-21T00:00:00Z',
      '2026-10-21T00:00:00.500Z',
      '2026-10-21T00:00:05Z',
      'garbage',
    ]);
  });

  it('이력이 없으면 빈 리플레이', () => {
    expect(buildReplayFromCraneHistories([], QUERY)).toEqual({
      from: QUERY.from,
      to: QUERY.to,
      craneIds: [],
      frames: [],
    });
  });

  it('프레임 값은 입력 객체의 복사본이다', () => {
    const source = history('C_171', [['2026-10-21T00:00:00Z', { a: 1 }]]);
    const result = buildReplayFromCraneHistories([source], QUERY);
    const values = result.frames[0]?.cranes[0]?.values;
    expect(values).toEqual({ a: 1 });
    expect(values).not.toBe(source.frames[0]?.values);
  });
});
