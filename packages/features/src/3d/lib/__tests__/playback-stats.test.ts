import { describe, expect, it } from 'vitest';
import {
  accumulateTagValue,
  addScannedInterval,
  computePlaybackStats,
  createTagAggregate,
  emptyStatusMs,
  loopIterationOf,
  sumScanned,
  type PlaybackEvent,
  type PlaybackStatsInput,
} from '../playback-stats';

let nextId = 1;
function ev(
  kind: PlaybackEvent['kind'],
  atMs: number,
  subject: string,
  extra: Partial<PlaybackEvent> = {},
): PlaybackEvent {
  return {
    id: nextId++,
    kind,
    atMs,
    frameIndex: null,
    subject,
    label: subject,
    ...extra,
  };
}

function input(patch: Partial<PlaybackStatsInput> = {}): PlaybackStatsInput {
  return {
    events: [],
    statuses: {},
    tags: {},
    scanned: [],
    windowEndMs: 60_000,
    scenarioDurationMs: null,
    holdWallMs: 0,
    detectionOffSeen: false,
    ...patch,
  };
}

describe('addScannedInterval / sumScanned', () => {
  it('겹침·인접은 합치고 떨어진 것은 정렬해 둔다', () => {
    let list = addScannedInterval([], 0, 1000);
    list = addScannedInterval(list, 5000, 6000);
    list = addScannedInterval(list, 1000, 2000); // 인접
    list = addScannedInterval(list, 5500, 7000); // 겹침
    expect(list).toEqual([
      { fromMs: 0, toMs: 2000 },
      { fromMs: 5000, toMs: 7000 },
    ]);
    expect(sumScanned(list)).toBe(4000);
  });

  it('뒤로 seek 뒤 다시 지나간 구간은 합집합이라 두 번 세지 않는다', () => {
    let list = addScannedInterval([], 0, 10_000);
    list = addScannedInterval(list, 3000, 12_000);
    expect(list).toEqual([{ fromMs: 0, toMs: 12_000 }]);
  });

  it('길이 0·역방향·NaN 은 무시하고 새 배열을 돌려준다', () => {
    const base = [{ fromMs: 0, toMs: 1 }];
    expect(addScannedInterval(base, 5, 5)).toEqual(base);
    expect(addScannedInterval(base, 9, 4)).toEqual(base);
    expect(addScannedInterval(base, Number.NaN, 4)).toEqual(base);
    expect(addScannedInterval(base, 5, 5)).not.toBe(base);
  });
});

describe('loopIterationOf', () => {
  it('경계: 길이 정확값에서 다음 회차', () => {
    expect(loopIterationOf(0, 90_000)).toBe(0);
    expect(loopIterationOf(89_999, 90_000)).toBe(0);
    expect(loopIterationOf(90_000, 90_000)).toBe(1);
    expect(loopIterationOf(-5, 90_000)).toBe(0);
  });
  it('열린 구간(null·0)은 null', () => {
    expect(loopIterationOf(1000, null)).toBeNull();
    expect(loopIterationOf(1000, 0)).toBeNull();
  });
});

describe('accumulateTagValue', () => {
  it('min/max/합/이동량을 누적하고 NaN 은 무시한다', () => {
    const agg = createTagAggregate('k', false);
    accumulateTagValue(agg, 10, 0, null);
    accumulateTagValue(agg, Number.NaN, 100, null);
    accumulateTagValue(agg, 4, 1000, null);
    accumulateTagValue(agg, 12, 2000, null);
    expect(agg.min).toBe(4);
    expect(agg.max).toBe(12);
    expect(agg.count).toBe(3);
    expect(agg.sum).toBe(26);
    expect(agg.travel).toBe(6 + 8);
    expect(agg.saturatedMs).toBe(0);
  });

  it('한계 속도의 98% 이상으로 움직인 구간만 포화로 센다', () => {
    const agg = createTagAggregate('k', true);
    accumulateTagValue(agg, 0, 0, 10);
    accumulateTagValue(agg, 10, 1000, 10); // 10/s = 한계 → 포화
    accumulateTagValue(agg, 15, 2000, 10); // 5/s → 아님
    accumulateTagValue(agg, 24.9, 3000, 10); // 9.9/s ≥ 9.8 → 포화
    expect(agg.saturatedMs).toBe(2000);
  });

  it('dt 가 0 이거나 한계가 없으면 포화를 세지 않는다', () => {
    const agg = createTagAggregate('k', true);
    accumulateTagValue(agg, 0, 0, 10);
    accumulateTagValue(agg, 100, 0, 10);
    accumulateTagValue(agg, 200, 1000, null);
    expect(agg.saturatedMs).toBe(0);
  });
});

describe('computePlaybackStats', () => {
  it('빈 입력은 0 으로 채운 리포트', () => {
    const stats = computePlaybackStats(input({ windowEndMs: 0 }));
    expect(stats.events).toEqual([]);
    expect(stats.collisions).toEqual({ count: 0, firstAtMs: null, byPair: [] });
    expect(stats.zones).toEqual({ enters: 0, stopEnters: 0, byZone: [] });
    expect(stats.holds).toEqual({ count: 0, wallMs: 0 });
    expect(stats.equipment).toEqual([]);
    expect(stats.tags).toEqual([]);
    expect(stats.loopIteration).toBeNull();
  });

  it('창 밖(현재 위치 이후) 사건은 감춘다 — 뒤로 seek 하면 표시가 줄어든다', () => {
    const events = [
      ev('collision', 1000, 'a|b'),
      ev('collision', 50_000, 'a|b'),
    ];
    expect(
      computePlaybackStats(input({ events, windowEndMs: 60_000 })).collisions
        .count,
    ).toBe(2);
    const back = computePlaybackStats(input({ events, windowEndMs: 20_000 }));
    expect(back.collisions.count).toBe(1);
    expect(back.events).toHaveLength(1);
  });

  it('충돌은 쌍별로 세고 첫 충돌 시각을 남긴다', () => {
    const events = [
      ev('collision', 9000, 'x|y', { label: 'X ↔ Y' }),
      ev('collision', 3000, 'a|b'),
      ev('collision', 7000, 'x|y', { label: 'X ↔ Y' }),
    ];
    const stats = computePlaybackStats(input({ events }));
    expect(stats.collisions.firstAtMs).toBe(3000);
    expect(stats.collisions.byPair[0]).toEqual({
      pairKey: 'x|y',
      label: 'X ↔ Y',
      count: 2,
      firstAtMs: 7000,
    });
  });

  it('영역: 체류는 진입~이탈, 미이탈은 창 끝까지, 진입 없는 이탈은 무시', () => {
    const zone = { zoneKey: 'm#z', zoneName: 'Z', intruderId: 'c' };
    const events = [
      ev('zoneEnter', 1000, 'm#z|c', { ...zone, level: 'stop' }),
      ev('zoneExit', 4000, 'm#z|c', zone),
      ev('zoneEnter', 10_000, 'm#z|c', { ...zone, level: 'stop' }),
      ev('zoneExit', 500, 'm#z|d', { ...zone, intruderId: 'd' }),
    ];
    const stats = computePlaybackStats(input({ events, windowEndMs: 15_000 }));
    expect(stats.zones.enters).toBe(2);
    expect(stats.zones.stopEnters).toBe(2);
    const z = stats.zones.byZone[0];
    expect(z.dwellMs).toBe(3000 + 5000);
    expect(z.maxDwellMs).toBe(5000);
    expect(z.open).toBe(1);
    expect(z.byIntruder).toEqual([
      { intruderId: 'c', intruderName: 'c', count: 2 },
    ]);
  });

  it('같은 쌍의 중복 진입(뒤로 seek 뒤 재통과)은 앞 진입을 닫는다', () => {
    const zone = { zoneKey: 'm#z', zoneName: 'Z', intruderId: 'c' };
    const events = [
      ev('zoneEnter', 1000, 'm#z|c', zone),
      ev('zoneEnter', 3000, 'm#z|c', zone),
      ev('zoneExit', 4000, 'm#z|c', zone),
    ];
    const z = computePlaybackStats(input({ events })).zones.byZone[0];
    expect(z.enters).toBe(2);
    expect(z.dwellMs).toBe(2000 + 1000);
    expect(z.open).toBe(0);
  });

  it('정지 중 이탈: 정지 횟수는 holdStart 수, 시간은 벽시계 입력 그대로', () => {
    const events = [
      ev('holdStart', 2000, 'zone'),
      ev('holdEnd', 2000, 'hold'),
      ev('holdStart', 8000, 'collision'),
    ];
    const stats = computePlaybackStats(input({ events, holdWallMs: 12_345 }));
    expect(stats.holds).toEqual({ count: 2, wallMs: 12_345 });
  });

  it('장비: 비율 분모와 두절 횟수', () => {
    const ms = emptyStatusMs();
    ms.running = 6000;
    ms.idle = 4000;
    const stats = computePlaybackStats(
      input({
        statuses: { m1: { modelId: 'm1', name: 'GC', ms } },
        events: [ev('offlineEnter', 100, 'm1'), ev('offlineEnter', 200, 'm1')],
      }),
    );
    expect(stats.equipment[0].totalMs).toBe(10_000);
    expect(stats.equipment[0].offlineEpisodes).toBe(2);
  });

  it('태그: 평균과 포화 비율(검사 시간 대비, 1 상한, 한계 없으면 null)', () => {
    const a = createTagAggregate('a', true);
    a.sum = 30;
    a.count = 3;
    a.saturatedMs = 5000;
    const b = createTagAggregate('b', false);
    const stats = computePlaybackStats(
      input({
        tags: { a, b },
        scanned: [{ fromMs: 0, toMs: 4000 }],
      }),
    );
    expect(stats.scannedMs).toBe(4000);
    expect(stats.tags[0].mean).toBe(10);
    expect(stats.tags[0].saturationRatio).toBe(1);
    expect(stats.tags[1].mean).toBeNull();
    expect(stats.tags[1].saturationRatio).toBeNull();
  });

  it('회차·검사 시간·NaN 창 방어', () => {
    const stats = computePlaybackStats(
      input({ windowEndMs: Number.NaN, scenarioDurationMs: 1000 }),
    );
    expect(stats.windowEndMs).toBe(0);
    expect(stats.loopIteration).toBe(0);
    expect(
      computePlaybackStats(
        input({ windowEndMs: 2500, scenarioDurationMs: 1000 }),
      ).loopIteration,
    ).toBe(2);
  });
});
