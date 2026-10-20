import { beforeEach, describe, expect, it } from 'vitest';
import type { CraneSnapshot } from '@crane/domain/monitoring';
import { useCraneSnapshotStore } from '../use-crane-snapshot-store';

function snapshot(
  craneId: string,
  tags: Record<string, number | boolean>,
): CraneSnapshot {
  const out: CraneSnapshot = {
    craneId,
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

beforeEach(() => {
  useCraneSnapshotStore.setState({ cranes: {}, order: [], loadError: false });
});

describe('useCraneSnapshotStore — applySnapshots', () => {
  it('새 크레인은 정렬된 order 에 들어가고 기존 크레인은 통계를 이어 간다', () => {
    const store = useCraneSnapshotStore.getState();
    store.applySnapshots(
      [snapshot('C_1806', { a: 1 }), snapshot('C_800', { a: 1 })],
      1_000,
    );
    expect(useCraneSnapshotStore.getState().order).toEqual(['C_800', 'C_1806']);
    store.applySnapshots([snapshot('C_800', { a: 2 })], 2_000);
    const state = useCraneSnapshotStore.getState();
    expect(state.cranes.C_800.stats.a.changeCount).toBe(1);
    expect(state.cranes.C_800.receivedAt).toBe(2_000);
    expect(state.cranes.C_1806.receivedAt).toBe(1_000);
  });

  it('바뀌지 않은 크레인 항목은 참조가 유지되고, 새 크레인이 없으면 order 도 그대로다', () => {
    const store = useCraneSnapshotStore.getState();
    store.applySnapshots(
      [snapshot('C_1', { a: 1 }), snapshot('C_2', { a: 1 })],
      0,
    );
    const before = useCraneSnapshotStore.getState();
    store.applySnapshots([snapshot('C_1', { a: 2 })], 1);
    const after = useCraneSnapshotStore.getState();
    expect(after.cranes.C_2).toBe(before.cranes.C_2);
    expect(after.cranes.C_1).not.toBe(before.cranes.C_1);
    expect(after.order).toBe(before.order);
  });

  it('빈 묶음은 상태 참조를 바꾸지 않는다', () => {
    const before = useCraneSnapshotStore.getState();
    before.applySnapshots([], 5);
    expect(useCraneSnapshotStore.getState()).toBe(before);
  });

  it('같은 묶음에 같은 크레인이 두 번 있으면 차례로 합친다', () => {
    const store = useCraneSnapshotStore.getState();
    store.applySnapshots(
      [snapshot('C_1', { a: 1 }), snapshot('C_1', { a: 2 })],
      0,
    );
    const entry = useCraneSnapshotStore.getState().cranes.C_1;
    expect(entry.snapshot.tags.a.value).toBe(2);
    expect(entry.stats.a).toEqual({
      changedAt: 0,
      changeCount: 1,
      min: 1,
      max: 2,
    });
    expect(useCraneSnapshotStore.getState().order).toEqual(['C_1']);
  });
});

describe('useCraneSnapshotStore — loadError / clear', () => {
  it('같은 값의 setLoadError 는 상태 참조를 유지한다', () => {
    const before = useCraneSnapshotStore.getState();
    before.setLoadError(false);
    expect(useCraneSnapshotStore.getState()).toBe(before);
    before.setLoadError(true);
    expect(useCraneSnapshotStore.getState().loadError).toBe(true);
  });

  it('clear 는 크레인·order·loadError 를 비운다', () => {
    const store = useCraneSnapshotStore.getState();
    store.applySnapshots([snapshot('C_1', { a: 1 })], 0);
    store.setLoadError(true);
    store.clear();
    expect(useCraneSnapshotStore.getState()).toMatchObject({
      cranes: {},
      order: [],
      loadError: false,
    });
  });
});
