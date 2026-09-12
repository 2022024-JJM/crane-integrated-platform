import { describe, expect, it } from 'vitest';
import {
  OFFLINE_WINDOW_MS,
  RUNNING_WINDOW_MS,
  RUNTIME_STATUS_COLORS,
  collectModelTagKeys,
  countRuntimeStatuses,
  isSameRuntimeStatusRecord,
  resolveRuntimeStatus,
  type TagActivity,
} from '../model-runtime-status';

const NOW = 1_000_000;

function activities(map: Record<string, TagActivity>) {
  return (key: string) => map[key];
}

describe('collectModelTagKeys', () => {
  it('맵핑의 tagKey 를 순서대로, 중복·빈 키 제거', () => {
    const model = {
      tagMappings: [
        { tagKey: 'A:x' },
        { tagKey: 'A:y' },
        { tagKey: 'A:x' },
        { tagKey: '' },
        { tagKey: 42 },
      ],
    } as unknown as Parameters<typeof collectModelTagKeys>[0];
    expect(collectModelTagKeys(model)).toEqual(['A:x', 'A:y']);
  });

  it('맵핑 없음은 빈 배열', () => {
    expect(collectModelTagKeys({})).toEqual([]);
    expect(collectModelTagKeys({ tagMappings: [] })).toEqual([]);
  });
});

describe('resolveRuntimeStatus', () => {
  it('키가 없거나 한 번도 못 받았으면 unknown', () => {
    expect(resolveRuntimeStatus([], activities({}), NOW)).toBe('unknown');
    expect(resolveRuntimeStatus(['k'], activities({}), NOW)).toBe('unknown');
    expect(
      resolveRuntimeStatus(
        ['k'],
        activities({ k: { at: NaN, changedAt: NaN } }),
        NOW,
      ),
    ).toBe('unknown');
  });

  it('변화가 창 안이면 running — 경계 정확값 포함, +1ms 는 idle', () => {
    const edge = { at: NOW, changedAt: NOW - RUNNING_WINDOW_MS };
    expect(resolveRuntimeStatus(['k'], activities({ k: edge }), NOW)).toBe(
      'running',
    );
    const past = { at: NOW, changedAt: NOW - RUNNING_WINDOW_MS - 1 };
    expect(resolveRuntimeStatus(['k'], activities({ k: past }), NOW)).toBe(
      'idle',
    );
  });

  it('수신이 창 안이면 idle, 넘으면 offline (경계 쌍)', () => {
    const edge = { at: NOW - OFFLINE_WINDOW_MS, changedAt: 0 };
    expect(resolveRuntimeStatus(['k'], activities({ k: edge }), NOW)).toBe(
      'idle',
    );
    const past = { at: NOW - OFFLINE_WINDOW_MS - 1, changedAt: 0 };
    expect(resolveRuntimeStatus(['k'], activities({ k: past }), NOW)).toBe(
      'offline',
    );
  });

  it('여러 키 중 하나만 움직여도 running, 가장 최근 수신이 기준', () => {
    const get = activities({
      a: { at: NOW - 100_000, changedAt: NOW - 100_000 },
      b: { at: NOW - 100, changedAt: NOW - 100 },
    });
    expect(resolveRuntimeStatus(['a', 'b'], get, NOW)).toBe('running');
    const stale = activities({
      a: { at: NOW - 100_000, changedAt: NOW - 100_000 },
      b: { at: NOW - 10_000, changedAt: NOW - 100_000 },
    });
    expect(resolveRuntimeStatus(['a', 'b'], stale, NOW)).toBe('idle');
  });
});

describe('isSameRuntimeStatusRecord / countRuntimeStatuses', () => {
  it('같은 내용이면 true, 키·값 다르면 false', () => {
    expect(isSameRuntimeStatusRecord({ a: 'idle' }, { a: 'idle' })).toBe(true);
    expect(isSameRuntimeStatusRecord({ a: 'idle' }, { a: 'running' })).toBe(
      false,
    );
    expect(
      isSameRuntimeStatusRecord({ a: 'idle' }, { a: 'idle', b: 'idle' }),
    ).toBe(false);
    expect(isSameRuntimeStatusRecord({}, {})).toBe(true);
  });

  it('집계 — known 은 unknown 제외', () => {
    expect(
      countRuntimeStatuses({
        a: 'running',
        b: 'running',
        c: 'idle',
        d: 'offline',
        e: 'unknown',
      }),
    ).toEqual({ running: 2, idle: 1, offline: 1, unknown: 1, known: 4 });
    expect(countRuntimeStatuses({})).toEqual({
      running: 0,
      idle: 0,
      offline: 0,
      unknown: 0,
      known: 0,
    });
  });

  it('unknown 은 색이 없다(기본 색 유지)', () => {
    expect(RUNTIME_STATUS_COLORS.unknown).toBeNull();
    expect(RUNTIME_STATUS_COLORS.running).toMatch(/^#/);
  });
});
