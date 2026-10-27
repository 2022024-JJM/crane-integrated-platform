import { describe, expect, it } from 'vitest';
import type { CraneSnapshotTag } from '@crane/domain/monitoring';
import type { CraneSnapshotEntry, CraneTagStat } from '../crane-snapshot-stats';
import {
  cloneRange,
  cloneTagsFromSnapshot,
  fallbackRange,
} from '../virtual-tag-clone';

function tag(value: number | boolean): CraneSnapshotTag {
  return { value, quality: 0, timestamp: null };
}

function stat(patch: Partial<CraneTagStat> = {}): CraneTagStat {
  return { changedAt: null, changeCount: 0, min: null, max: null, ...patch };
}

const entry: Pick<CraneSnapshotEntry, 'snapshot' | 'stats'> = {
  snapshot: {
    craneId: 'C_1',
    stationId: null,
    bay: 'B',
    snapshotAt: null,
    lastReceivedAt: null,
    online: true,
    tags: {
      heartbeat: tag(true),
      mh1_weight: tag(12),
      tl_distance: tag(120),
      crane_system_error: tag(false),
      year: tag(2026),
    },
  },
  stats: {
    heartbeat: stat(),
    mh1_weight: stat({ changeCount: 3, min: 5, max: 20 }),
    tl_distance: stat({ min: 120, max: 120 }),
    crane_system_error: stat(),
    year: stat({ min: 2026, max: 2026 }),
  },
};

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

describe('fallbackRange / cloneRange', () => {
  it('기본 폭 — 0 과 작은 값은 0~100, 큰 양수는 0~2배, 음수는 -2배~0', () => {
    expect(fallbackRange(0)).toEqual({ min: 0, max: 100 });
    expect(fallbackRange(30)).toEqual({ min: 0, max: 100 });
    expect(fallbackRange(120)).toEqual({ min: 0, max: 240 });
    expect(fallbackRange(-5)).toEqual({ min: -100, max: 0 });
  });

  it('관측 범위가 있으면 쓰고 현재값이 밖이면 넓힌다. 한 점·없음은 기본 폭', () => {
    expect(cloneRange(12, { min: 5, max: 20 })).toEqual({ min: 5, max: 20 });
    expect(cloneRange(25, { min: 5, max: 20 })).toEqual({ min: 5, max: 25 });
    expect(cloneRange(-1, { min: 5, max: 20 })).toEqual({ min: -1, max: 20 });
    expect(cloneRange(120, { min: 120, max: 120 })).toEqual({
      min: 0,
      max: 240,
    });
    expect(cloneRange(7, { min: null, max: null })).toEqual({
      min: 0,
      max: 100,
    });
    expect(cloneRange(7, { min: NaN, max: 9 })).toEqual({ min: 0, max: 100 });
  });
});

describe('cloneTagsFromSnapshot', () => {
  it('카탈로그 묶음 순(시각 › 계측값 › 상태)으로 복제하고 id 는 nextId 순서다', () => {
    const out = cloneTagsFromSnapshot(entry, { nextId: ids() });
    expect(out.map((t) => [t.id, t.code])).toEqual([
      ['id1', 'year'],
      ['id2', 'mh1_weight'],
      ['id3', 'tl_distance'],
      ['id4', 'crane_system_error'],
      ['id5', 'heartbeat'],
    ]);
  });

  it('숫자는 현재값·관측 범위·단위·표시명, 패턴은 수동 — 옛 필드는 없다', () => {
    const out = cloneTagsFromSnapshot(entry, { nextId: ids() });
    const weight = out.find((t) => t.code === 'mh1_weight')!;
    expect(weight).toEqual({
      id: 'id2',
      code: 'mh1_weight',
      name: 'MH#1 Weight',
      dataType: 'number',
      unit: 'ton',
      min: 5,
      max: 20,
      initial: 12,
      pattern: { kind: 'manual' },
    });
    const distance = out.find((t) => t.code === 'tl_distance')!;
    expect(distance).toMatchObject({
      min: 0,
      max: 240,
      initial: 120,
      unit: 'm',
    });
    const year = out.find((t) => t.code === 'year')!;
    expect(year).toMatchObject({ min: 0, max: 4052, initial: 2026 });
    expect(year).not.toHaveProperty('unit');
  });

  it('불리언은 bool 형식 0~1, 초기값은 현재 비트, 단위·옛 필드 없음', () => {
    const out = cloneTagsFromSnapshot(entry, { nextId: ids() });
    const heartbeat = out.find((t) => t.code === 'heartbeat')!;
    expect(heartbeat).toMatchObject({
      dataType: 'bool',
      min: 0,
      max: 1,
      initial: 1,
      pattern: { kind: 'manual' },
    });
    expect(Object.keys(heartbeat).sort()).toEqual([
      'code',
      'dataType',
      'id',
      'initial',
      'max',
      'min',
      'name',
      'pattern',
    ]);
    expect(out.find((t) => t.code === 'crane_system_error')).toMatchObject({
      dataType: 'bool',
      initial: 0,
      name: 'Crane System Error',
    });
  });

  it('codes 로 고른 것만 복제한다 — 모르는 코드는 무시, 빈 집합은 빈 결과', () => {
    expect(
      cloneTagsFromSnapshot(entry, {
        codes: new Set(['mh1_weight', 'nope']),
        nextId: ids(),
      }).map((t) => t.code),
    ).toEqual(['mh1_weight']);
    expect(
      cloneTagsFromSnapshot(entry, { codes: new Set(), nextId: ids() }),
    ).toEqual([]);
  });

  it('빈 스냅샷은 빈 결과이고, 같은 입력은 같은 출력(결정론)', () => {
    const empty = { snapshot: { ...entry.snapshot, tags: {} }, stats: {} };
    expect(cloneTagsFromSnapshot(empty, { nextId: ids() })).toEqual([]);
    expect(cloneTagsFromSnapshot(entry, { nextId: ids() })).toEqual(
      cloneTagsFromSnapshot(entry, { nextId: ids() }),
    );
  });
});
