import { beforeEach, describe, expect, it } from 'vitest';
import type { CraneScope, CraneSnapshot } from '@crane/domain/monitoring';
import {
  EMPTY_CRANE_FEED,
  selectCraneFeed,
  useCraneSnapshotStore,
} from '../use-crane-snapshot-store';

function snapshot(
  craneId: string,
  tags: Record<string, number | boolean | null>,
  scope: CraneScope = 'indoor',
): CraneSnapshot {
  const out: CraneSnapshot = {
    craneId,
    scope,
    stationId: null,
    bay: null,
    snapshotAt: null,
    lastReceivedAt: null,
    online: true,
    tags: {},
  };
  for (const [code, value] of Object.entries(tags)) {
    out.tags[code] = { value, quality: 0, timestamp: null };
  }
  return out;
}

function feed(scope: CraneScope) {
  return useCraneSnapshotStore.getState().byScope[scope];
}

beforeEach(() => {
  useCraneSnapshotStore.getState().clear();
});

describe('useCraneSnapshotStore — applySnapshots', () => {
  it('새 크레인은 정렬된 order 에 들어가고 기존 크레인은 통계를 이어 간다', () => {
    const store = useCraneSnapshotStore.getState();
    store.applySnapshots(
      'indoor',
      [snapshot('C_1806', { a: 1 }), snapshot('C_800', { a: 1 })],
      1_000,
    );
    expect(feed('indoor').order).toEqual(['C_800', 'C_1806']);
    store.applySnapshots('indoor', [snapshot('C_800', { a: 2 })], 2_000);
    const state = feed('indoor');
    expect(state.cranes.C_800.stats.a.changeCount).toBe(1);
    expect(state.cranes.C_800.receivedAt).toBe(2_000);
    expect(state.cranes.C_1806.receivedAt).toBe(1_000);
  });

  it('바뀌지 않은 크레인 항목은 참조가 유지되고, 새 크레인이 없으면 order 도 그대로다', () => {
    const store = useCraneSnapshotStore.getState();
    store.applySnapshots(
      'indoor',
      [snapshot('C_1', { a: 1 }), snapshot('C_2', { a: 1 })],
      0,
    );
    const before = feed('indoor');
    store.applySnapshots('indoor', [snapshot('C_1', { a: 2 })], 1);
    const after = feed('indoor');
    expect(after.cranes.C_2).toBe(before.cranes.C_2);
    expect(after.cranes.C_1).not.toBe(before.cranes.C_1);
    expect(after.order).toBe(before.order);
  });

  it('묶음을 받을 때마다 마지막 수신 시각이 그 시각이 되고 clear 로 비운다', () => {
    const store = useCraneSnapshotStore.getState();
    expect(feed('indoor').lastReceivedAt).toBeNull();
    store.applySnapshots('indoor', [snapshot('C_1', { a: 1 })], 1_000);
    expect(feed('indoor').lastReceivedAt).toBe(1_000);
    // 새 크레인이 없는 묶음도 수신이다.
    store.applySnapshots('indoor', [snapshot('C_1', { a: 1 })], 2_000);
    expect(feed('indoor').lastReceivedAt).toBe(2_000);
    store.clear();
    expect(feed('indoor').lastReceivedAt).toBeNull();
  });

  it('빈 묶음은 상태 참조를 바꾸지 않는다', () => {
    const before = useCraneSnapshotStore.getState();
    before.applySnapshots('outdoor', [], 5);
    expect(useCraneSnapshotStore.getState()).toBe(before);
  });

  it('같은 묶음에 같은 크레인이 두 번 있으면 차례로 합친다', () => {
    const store = useCraneSnapshotStore.getState();
    store.applySnapshots(
      'indoor',
      [snapshot('C_1', { a: 1 }), snapshot('C_1', { a: 2 })],
      0,
    );
    const entry = feed('indoor').cranes.C_1;
    expect(entry.snapshot.tags.a.value).toBe(2);
    expect(entry.stats.a).toEqual({
      changedAt: 0,
      changeCount: 1,
      min: 1,
      max: 2,
    });
    expect(feed('indoor').order).toEqual(['C_1']);
  });

  it('값 없음(null) 태그도 항목에 남는다', () => {
    useCraneSnapshotStore
      .getState()
      .applySnapshots(
        'outdoor',
        [snapshot('GC_01', { x: null }, 'outdoor')],
        0,
      );
    expect(feed('outdoor').cranes.GC_01.snapshot.tags.x.value).toBeNull();
  });
});

describe('useCraneSnapshotStore — 범위 칸', () => {
  it('범위마다 칸이 따로라 목록·수신 시각이 섞이지 않고 다른 칸의 참조는 그대로다', () => {
    const store = useCraneSnapshotStore.getState();
    store.applySnapshots('indoor', [snapshot('C_171', { a: 1 })], 1_000);
    const indoor = feed('indoor');
    store.applySnapshots(
      'outdoor',
      [
        snapshot('TTC_02', { a: 1 }, 'outdoor'),
        snapshot('GC_01', { a: 1 }, 'outdoor'),
      ],
      2_000,
    );
    expect(feed('indoor')).toBe(indoor);
    expect(feed('indoor').order).toEqual(['C_171']);
    expect(feed('outdoor').order).toEqual(['GC_01', 'TTC_02']);
    expect(feed('outdoor').lastReceivedAt).toBe(2_000);
    expect(feed('indoor').lastReceivedAt).toBe(1_000);
  });

  it('selectCraneFeed — 범위가 null 이면 고정된 빈 칸', () => {
    const state = useCraneSnapshotStore.getState();
    expect(selectCraneFeed(state, null)).toBe(EMPTY_CRANE_FEED);
    expect(selectCraneFeed(state, null)).toBe(selectCraneFeed(state, null));
    expect(selectCraneFeed(state, 'outdoor')).toBe(state.byScope.outdoor);
    expect(EMPTY_CRANE_FEED).toEqual({
      cranes: {},
      order: [],
      loadError: false,
      lastReceivedAt: null,
    });
  });

  it('빈 칸은 두 범위가 처음에 함께 가리키므로 얼려 둔다', () => {
    expect(Object.isFrozen(EMPTY_CRANE_FEED)).toBe(true);
  });
});

describe('useCraneSnapshotStore — loadError / clear', () => {
  it('같은 값의 setLoadError 는 상태 참조를 유지한다', () => {
    const before = useCraneSnapshotStore.getState();
    before.setLoadError('indoor', false);
    expect(useCraneSnapshotStore.getState()).toBe(before);
    before.setLoadError('indoor', true);
    expect(feed('indoor').loadError).toBe(true);
    expect(feed('outdoor').loadError).toBe(false);
  });

  it('clear 는 두 범위의 크레인·order·loadError 를 비운다', () => {
    const store = useCraneSnapshotStore.getState();
    store.applySnapshots('indoor', [snapshot('C_1', { a: 1 })], 0);
    store.applySnapshots(
      'outdoor',
      [snapshot('GC_01', { a: 1 }, 'outdoor')],
      0,
    );
    store.setLoadError('outdoor', true);
    store.clear();
    for (const scope of ['indoor', 'outdoor'] as const) {
      expect(feed(scope)).toMatchObject({
        cranes: {},
        order: [],
        loadError: false,
        lastReceivedAt: null,
      });
    }
  });
});
