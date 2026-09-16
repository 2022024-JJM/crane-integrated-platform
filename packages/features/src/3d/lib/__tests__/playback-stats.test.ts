import { describe, expect, it } from 'vitest';
import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import {
  accumulateTagValue,
  addScannedInterval,
  computePlaybackStats,
  createTagAggregate,
  cumulativeSeries,
  emptyStatusMs,
  holdBands,
  loopIterationOf,
  rankZoneIntruders,
  runningRatioSeries,
  statusBands,
  sumScanned,
  tagRangeBar,
  topN,
  zoneBands,
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

describe('시간 축 파생 — cumulativeSeries', () => {
  it('격자마다 누적 개수, 창 끝에서 멈추고 창 밖 사건은 세지 않는다', () => {
    const events = [
      ev('collision', 1000, 'a'),
      ev('collision', 2500, 'a'),
      ev('collision', 9000, 'a'),
      ev('zoneEnter', 500, 'z'),
    ];
    const pts = cumulativeSeries(events, ['collision'], 10_000, 4000, 4);
    expect(pts).toEqual([
      { t: 0, v: 0 },
      { t: 2500, v: 2 },
      { t: 4000, v: 2 },
    ]);
  });

  it('빈 사건·축 0 은 창 끝 한 점', () => {
    expect(cumulativeSeries([], ['collision'], 0, 0)).toEqual([{ t: 0, v: 0 }]);
    expect(cumulativeSeries([], ['collision'], 5000, 3000, 5)).toEqual([
      { t: 0, v: 0 },
      { t: 1000, v: 0 },
      { t: 2000, v: 0 },
      { t: 3000, v: 0 },
    ]);
  });
});

describe('시간 축 파생 — statusBands / clipBands', () => {
  const tr = (
    atMs: number,
    modelId: string,
    from: EquipmentRuntimeStatus,
    to: EquipmentRuntimeStatus,
  ) => ({
    atMs,
    modelId,
    from,
    to,
  });

  it('전이 사이가 밴드, 마지막 전이는 창 끝까지, 다른 장비는 무시', () => {
    const bands = statusBands(
      [
        tr(1000, 'm', 'unknown', 'running'),
        tr(4000, 'm', 'running', 'idle'),
        tr(2000, 'x', 'unknown', 'offline'),
      ],
      'm',
      6000,
    );
    expect(bands).toEqual([
      { fromMs: 1000, toMs: 4000, status: 'running' },
      { fromMs: 4000, toMs: 6000, status: 'idle' },
    ]);
  });

  it('전이 0개는 빈 배열, 창 끝 이후 전이는 잘린다', () => {
    expect(statusBands([], 'm', 5000)).toEqual([]);
    expect(
      statusBands([tr(7000, 'm', 'unknown', 'running')], 'm', 5000),
    ).toEqual([]);
  });

  it('검사 구간 밖은 지운다(뒤로 seek 뒤 건너뛴 구간)', () => {
    const bands = statusBands([tr(0, 'm', 'unknown', 'running')], 'm', 10_000, [
      { fromMs: 0, toMs: 2000 },
      { fromMs: 6000, toMs: 8000 },
    ]);
    expect(bands).toEqual([
      { fromMs: 0, toMs: 2000, status: 'running' },
      { fromMs: 6000, toMs: 8000, status: 'running' },
    ]);
  });
});

describe('시간 축 파생 — zoneBands / holdBands', () => {
  const zone = {
    zoneKey: 'm#z',
    zoneName: 'Z',
    intruderId: 'c',
    intruderName: 'C',
  };

  it('진입~이탈 밴드, 미이탈은 창 끝까지 open, 진입 없는 이탈 무시', () => {
    const events = [
      ev('zoneEnter', 1000, 'm#z|c', { ...zone, level: 'stop' }),
      ev('zoneExit', 3000, 'm#z|c', zone),
      ev('zoneEnter', 5000, 'm#z|c', zone),
      ev('zoneExit', 100, 'm#z|d', { ...zone, intruderId: 'd' }),
      ev('zoneEnter', 9000, 'm#z|c', zone), // 창 밖
    ];
    const bands = zoneBands(events, 7000);
    expect(bands).toHaveLength(2);
    expect(bands[0]).toMatchObject({
      fromMs: 1000,
      toMs: 3000,
      level: 'stop',
      open: false,
    });
    expect(bands[1]).toMatchObject({ fromMs: 5000, toMs: 7000, open: true });
  });

  it('중복 진입은 앞 밴드를 닫는다', () => {
    const bands = zoneBands(
      [
        ev('zoneEnter', 1000, 'm#z|c', zone),
        ev('zoneEnter', 2000, 'm#z|c', zone),
      ],
      4000,
    );
    expect(bands.map((b) => [b.fromMs, b.toMs, b.open])).toEqual([
      [1000, 2000, false],
      [2000, 4000, true],
    ]);
  });

  it('정지 시작·해제 짝짓기, 미해제는 창 끝까지', () => {
    const bands = holdBands(
      [
        ev('holdStart', 1000, 'collision'),
        ev('holdEnd', 1000, 'hold'),
        ev('holdStart', 3000, 'zone'),
      ],
      5000,
    );
    expect(bands).toEqual([
      { fromMs: 1000, toMs: 1000, subject: 'collision' },
      { fromMs: 3000, toMs: 5000, subject: 'zone' },
    ]);
  });
});

describe('시간 축 파생 — runningRatioSeries', () => {
  it('상태를 아는 시간 대비 가동 시간의 누적 비율, 분모 0 인 격자는 건너뛴다', () => {
    const transitions = [
      {
        atMs: 0,
        modelId: 'm',
        from: 'unknown' as const,
        to: 'running' as const,
      },
      {
        atMs: 2000,
        modelId: 'm',
        from: 'running' as const,
        to: 'idle' as const,
      },
    ];
    const pts = runningRatioSeries(
      transitions,
      [{ fromMs: 0, toMs: 4000 }],
      4000,
      4000,
      4,
    );
    expect(pts.map((p) => [p.t, Number(p.v.toFixed(2))])).toEqual([
      [1000, 1],
      [2000, 1],
      [3000, 0.67],
      [4000, 0.5],
    ]);
  });
});

describe('순위·range bar', () => {
  it('rankZoneIntruders 는 횟수 내림차순 상위 N, 동률은 원래 순서', () => {
    const zones = [
      {
        zoneKey: 'a',
        zoneName: 'A',
        level: 'warn' as const,
        enters: 3,
        stopEnters: 0,
        dwellMs: 0,
        maxDwellMs: 0,
        open: 0,
        byIntruder: [
          { intruderId: 'x', intruderName: 'X', count: 1 },
          { intruderId: 'y', intruderName: 'Y', count: 2 },
        ],
      },
      {
        zoneKey: 'b',
        zoneName: 'B',
        level: 'stop' as const,
        enters: 2,
        stopEnters: 2,
        dwellMs: 0,
        maxDwellMs: 0,
        open: 0,
        byIntruder: [{ intruderId: 'z', intruderName: 'Z', count: 2 }],
      },
    ];
    const ranks = rankZoneIntruders(zones, 2);
    expect(ranks.map((r) => `${r.zoneKey}|${r.intruderId}`)).toEqual([
      'a|y',
      'b|z',
    ]);
    expect(topN([1, 2, 3], 0)).toEqual([]);
    expect(topN([1, 2, 3], 9)).toEqual([1, 2, 3]);
  });

  it('tagRangeBar 는 정의 범위 안 위치, 범위 밖은 clamp, 0건·NaN 은 null', () => {
    const agg = { min: 10, max: 30, sum: 60, count: 3 };
    expect(tagRangeBar(agg, { min: 0, max: 40 })).toEqual({
      min: 0.25,
      mean: 0.5,
      max: 0.75,
      lo: 0,
      hi: 40,
    });
    expect(tagRangeBar(agg, { min: 15, max: 25 })).toMatchObject({
      min: 0,
      max: 1,
    });
    // 정의 없음 → 관측 범위, min=0 max=1
    expect(tagRangeBar(agg, null)).toMatchObject({ min: 0, max: 1, mean: 0.5 });
    expect(
      tagRangeBar({ min: 5, max: 5, sum: 10, count: 2 }, null),
    ).toMatchObject({ min: 0, max: 0, hi: 6 });
    expect(
      tagRangeBar({ min: Number.NaN, max: Number.NaN, sum: 0, count: 0 }, null),
    ).toBeNull();
  });
});
