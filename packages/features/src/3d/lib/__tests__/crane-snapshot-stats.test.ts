import { describe, expect, it } from 'vitest';
import type { CraneSnapshot } from '@crane/domain/monitoring';
import {
  HEARTBEAT_STALE_MS,
  createCraneSnapshotEntry,
  mergeCraneSnapshot,
  resolveCraneLiveState,
} from '../crane-snapshot-stats';

function snapshot(
  tags: Record<string, number | boolean>,
  overrides: Partial<CraneSnapshot> = {},
): CraneSnapshot {
  const out: CraneSnapshot = {
    craneId: 'C_867',
    stationId: 'isl-ocean-crane',
    bay: 'F5_1_Bay',
    snapshotAt: '2026-10-20T04:21:27.864Z',
    lastReceivedAt: '2026-10-20T04:21:28.831Z',
    online: true,
    tags: {},
    ...overrides,
  };
  for (const [code, value] of Object.entries(tags)) {
    out.tags[code] = { value, quality: 0, timestamp: out.snapshotAt };
  }
  return out;
}

describe('createCraneSnapshotEntry', () => {
  it('통계는 비어 있고 숫자 태그의 관측 범위는 현재 값 하나다', () => {
    const entry = createCraneSnapshotEntry(
      snapshot({ mh1_weight: 1743, heartbeat: true }),
      1_000,
    );
    expect(entry.receivedAt).toBe(1_000);
    expect(entry.heartbeatAt).toBeNull();
    expect(entry.stats.mh1_weight).toEqual({
      changedAt: null,
      changeCount: 0,
      min: 1743,
      max: 1743,
    });
    expect(entry.stats.heartbeat).toEqual({
      changedAt: null,
      changeCount: 0,
      min: null,
      max: null,
    });
  });

  it('빈 태그 맵도 받는다', () => {
    const entry = createCraneSnapshotEntry(snapshot({}), 1_000);
    expect(entry.stats).toEqual({});
  });
});

describe('mergeCraneSnapshot', () => {
  it('바뀐 태그만 변경 시각·횟수·범위를 갱신하고 안 바뀐 stat 은 참조를 유지한다', () => {
    const first = createCraneSnapshotEntry(
      snapshot({ mh1_weight: 1743, tl_distance: 500, heartbeat: true }),
      1_000,
    );
    const second = mergeCraneSnapshot(
      first,
      snapshot({ mh1_weight: 1700, tl_distance: 500, heartbeat: true }),
      2_000,
    );
    expect(second.receivedAt).toBe(2_000);
    expect(second.stats.mh1_weight).toEqual({
      changedAt: 2_000,
      changeCount: 1,
      min: 1700,
      max: 1743,
    });
    expect(second.stats.tl_distance).toBe(first.stats.tl_distance);
    expect(second.stats.heartbeat).toBe(first.stats.heartbeat);
    expect(second.heartbeatAt).toBeNull();
  });

  it('heartbeat 가 뒤집히면 heartbeatAt 이 수신 시각이 되고, 그대로면 이전 값을 유지한다', () => {
    const first = createCraneSnapshotEntry(
      snapshot({ heartbeat: true }),
      1_000,
    );
    const flipped = mergeCraneSnapshot(
      first,
      snapshot({ heartbeat: false }),
      2_000,
    );
    expect(flipped.heartbeatAt).toBe(2_000);
    expect(flipped.stats.heartbeat.changeCount).toBe(1);
    const same = mergeCraneSnapshot(
      flipped,
      snapshot({ heartbeat: false }),
      3_000,
    );
    expect(same.heartbeatAt).toBe(2_000);
    expect(same.stats.heartbeat).toBe(flipped.stats.heartbeat);
  });

  it('관측 범위는 접속 후 최소·최대를 누적한다', () => {
    let entry = createCraneSnapshotEntry(snapshot({ v: 10 }), 0);
    entry = mergeCraneSnapshot(entry, snapshot({ v: 30 }), 1);
    entry = mergeCraneSnapshot(entry, snapshot({ v: -5 }), 2);
    entry = mergeCraneSnapshot(entry, snapshot({ v: 12 }), 3);
    expect(entry.stats.v).toEqual({
      changedAt: 3,
      changeCount: 3,
      min: -5,
      max: 30,
    });
  });

  it('새로 나타난 태그는 첫 수신처럼 시작하고, 사라진 태그는 통계에서 빠진다', () => {
    const first = createCraneSnapshotEntry(snapshot({ a: 1, b: 2 }), 0);
    const next = mergeCraneSnapshot(first, snapshot({ a: 1, c: 3 }), 1);
    expect(Object.keys(next.stats).sort()).toEqual(['a', 'c']);
    expect(next.stats.c).toEqual({
      changedAt: null,
      changeCount: 0,
      min: 3,
      max: 3,
    });
  });

  it('불리언 → 숫자처럼 타입이 바뀌어도 범위는 숫자 값만 쌓는다', () => {
    const first = createCraneSnapshotEntry(snapshot({ x: true }), 0);
    const next = mergeCraneSnapshot(first, snapshot({ x: 7 }), 1);
    expect(next.stats.x).toEqual({
      changedAt: 1,
      changeCount: 1,
      min: 7,
      max: 7,
    });
    const back = mergeCraneSnapshot(next, snapshot({ x: false }), 2);
    expect(back.stats.x).toEqual({
      changedAt: 2,
      changeCount: 2,
      min: 7,
      max: 7,
    });
  });

  it('스냅샷 메타(online 등)는 새 값으로 바뀐다', () => {
    const first = createCraneSnapshotEntry(snapshot({ a: 1 }), 0);
    const next = mergeCraneSnapshot(
      first,
      snapshot({ a: 1 }, { online: false }),
      1,
    );
    expect(next.snapshot.online).toBe(false);
  });
});

describe('resolveCraneLiveState', () => {
  const base = {
    snapshot: snapshot({}),
    receivedAt: 10_000,
    heartbeatAt: 10_000,
  };

  it('연결이 없거나 서버가 오프라인으로 표시하면 off', () => {
    expect(resolveCraneLiveState(base, 10_100, false)).toBe('off');
    expect(
      resolveCraneLiveState(
        { ...base, snapshot: snapshot({}, { online: false }) },
        10_100,
        true,
      ),
    ).toBe('off');
  });

  it('heartbeat 가 창 안에서 뒤집혔으면 live, 정확히 창 끝부터 stale', () => {
    expect(
      resolveCraneLiveState(base, 10_000 + HEARTBEAT_STALE_MS - 1, true),
    ).toBe('live');
    expect(resolveCraneLiveState(base, 10_000 + HEARTBEAT_STALE_MS, true)).toBe(
      'stale',
    );
  });

  it('첫 수신 직후(heartbeatAt null)는 수신 시각을 기준으로 live 다', () => {
    const fresh = { ...base, heartbeatAt: null };
    expect(resolveCraneLiveState(fresh, 10_500, true)).toBe('live');
    expect(
      resolveCraneLiveState(fresh, 10_000 + HEARTBEAT_STALE_MS, true),
    ).toBe('stale');
  });

  it('창 크기를 바꿀 수 있다', () => {
    expect(resolveCraneLiveState(base, 10_600, true, 500)).toBe('stale');
    expect(resolveCraneLiveState(base, 10_600, true, 5_000)).toBe('live');
  });
});
