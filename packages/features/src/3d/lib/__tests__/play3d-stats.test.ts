import { describe, expect, it } from 'vitest';
import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import {
  REPASS_JITTER_MS,
  accumulateTagValue,
  addScannedInterval,
  assignCollisionsToRows,
  assignZoneBandsToRows,
  collisionSummaries,
  computePlay3dStats,
  createTagAggregate,
  decideZoneEvent,
  emptyStatusMs,
  hasEventNear,
  lastEventAtMs,
  loopIterationOf,
  openZoneSubjectsAt,
  statusBands,
  sumScanned,
  tagRangeBar,
  zoneBands,
  zoneLogStateAt,
  type Play3dEvent,
  type Play3dStatsInput,
  type ZoneBand,
} from '../play3d-stats';

let nextId = 1;
function ev(
  kind: Play3dEvent['kind'],
  atMs: number,
  subject: string,
  extra: Partial<Play3dEvent> = {},
): Play3dEvent {
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

function input(patch: Partial<Play3dStatsInput> = {}): Play3dStatsInput {
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

describe('computePlay3dStats', () => {
  it('빈 입력은 0 으로 채운 리포트', () => {
    const stats = computePlay3dStats(input({ windowEndMs: 0 }));
    expect(stats.events).toEqual([]);
    expect(stats.collisions).toEqual({ count: 0, firstAtMs: null, byPair: [] });
    expect(stats.zones).toEqual({
      enters: 0,
      stopEnters: 0,
      dwellMs: 0,
      maxDwellMs: 0,
      byZone: [],
    });
    expect(stats.holds).toEqual({ count: 0, wallMs: 0 });
    expect(stats.equipment).toEqual([]);
    expect(stats.tags).toEqual([]);
    expect(stats.loopIteration).toBeNull();
    expect(stats.summary).toEqual({
      equipmentCount: 0,
      runningRatio: null,
      idleRatio: null,
      offlineEpisodes: 0,
      offlineMs: 0,
      saturation: { maxRatio: null, key: null },
    });
  });

  it('창 밖(현재 위치 이후) 사건은 감춘다 — 뒤로 seek 하면 표시가 줄어든다', () => {
    const events = [
      ev('collision', 1000, 'a|b'),
      ev('collision', 50_000, 'a|b'),
    ];
    expect(
      computePlay3dStats(input({ events, windowEndMs: 60_000 })).collisions
        .count,
    ).toBe(2);
    const back = computePlay3dStats(input({ events, windowEndMs: 20_000 }));
    expect(back.collisions.count).toBe(1);
    expect(back.events).toHaveLength(1);
  });

  it('충돌은 쌍별로 세고 첫 충돌 시각을 남긴다', () => {
    const events = [
      ev('collision', 9000, 'x|y', { label: 'X ↔ Y' }),
      ev('collision', 3000, 'a|b'),
      ev('collision', 7000, 'x|y', { label: 'X ↔ Y' }),
    ];
    const stats = computePlay3dStats(input({ events }));
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
    const stats = computePlay3dStats(input({ events, windowEndMs: 15_000 }));
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
    const z = computePlay3dStats(input({ events })).zones.byZone[0];
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
    const stats = computePlay3dStats(input({ events, holdWallMs: 12_345 }));
    expect(stats.holds).toEqual({ count: 2, wallMs: 12_345 });
  });

  it('장비: 비율 분모(unknown 제외)와 두절 횟수, 노출 기본값 0', () => {
    const ms = emptyStatusMs();
    ms.running = 6000;
    ms.idle = 4000;
    ms.unknown = 5000;
    const stats = computePlay3dStats(
      input({
        statuses: { m1: { modelId: 'm1', name: 'GC', ms } },
        events: [ev('offlineEnter', 100, 'm1'), ev('offlineEnter', 200, 'm1')],
      }),
    );
    expect(stats.equipment[0]).toMatchObject({
      totalMs: 15_000,
      offlineEpisodes: 2,
      zoneDwellMs: 0,
      zoneEnters: 0,
      collisions: 0,
    });
    expect(stats.summary).toMatchObject({
      equipmentCount: 1,
      runningRatio: 0.6,
      idleRatio: 0.4,
      offlineEpisodes: 2,
      offlineMs: 0,
    });
  });

  it('summary: unknown 만 있는 장비는 가동·대기 비율 null', () => {
    const ms = emptyStatusMs();
    ms.unknown = 3000;
    const stats = computePlay3dStats(
      input({ statuses: { m1: { modelId: 'm1', name: 'A', ms } } }),
    );
    expect(stats.summary.equipmentCount).toBe(1);
    expect(stats.summary.runningRatio).toBeNull();
    expect(stats.summary.idleRatio).toBeNull();
  });

  it('summary: 두절 횟수·시간은 장비 합', () => {
    const a = emptyStatusMs();
    a.offline = 2000;
    a.running = 1000;
    const b = emptyStatusMs();
    b.offline = 3000;
    const stats = computePlay3dStats(
      input({
        statuses: {
          a: { modelId: 'a', name: 'A', ms: a },
          b: { modelId: 'b', name: 'B', ms: b },
        },
        events: [
          ev('offlineEnter', 100, 'a'),
          ev('offlineEnter', 200, 'b'),
          ev('offlineEnter', 300, 'b'),
        ],
      }),
    );
    expect(stats.summary.offlineEpisodes).toBe(3);
    expect(stats.summary.offlineMs).toBe(5000);
  });

  it('summary: 포화 최대는 한계 있는 태그 중 최댓값, 동률은 키 순서 앞, 없으면 null', () => {
    const a = createTagAggregate('a', true);
    a.saturatedMs = 2000;
    const b = createTagAggregate('b', true);
    b.saturatedMs = 4000;
    const c = createTagAggregate('c', false);
    c.saturatedMs = 9000;
    const scanned = [{ fromMs: 0, toMs: 4000 }];
    expect(
      computePlay3dStats(input({ tags: { a, b, c }, scanned })).summary
        .saturation,
    ).toEqual({ maxRatio: 1, key: 'b' });
    b.saturatedMs = 2000;
    expect(
      computePlay3dStats(input({ tags: { b, a }, scanned })).summary.saturation,
    ).toEqual({ maxRatio: 0.5, key: 'a' });
    expect(
      computePlay3dStats(input({ tags: { c }, scanned })).summary.saturation,
    ).toEqual({ maxRatio: null, key: null });
    expect(
      computePlay3dStats(input({ tags: { a }, scanned: [] })).summary
        .saturation,
    ).toEqual({ maxRatio: null, key: null });
  });

  it('장비 행은 statuses ∪ statusTransitions — 전이만 있는 장비는 0ms·이름=id, 이름순', () => {
    const ms = emptyStatusMs();
    ms.running = 1000;
    const stats = computePlay3dStats(
      input({
        statuses: { z: { modelId: 'z', name: 'Zed', ms } },
        statusTransitions: [
          { atMs: 0, modelId: 'a', from: 'unknown', to: 'idle' },
          { atMs: 0, modelId: 'z', from: 'unknown', to: 'running' },
        ],
      }),
    );
    expect(stats.equipment.map((e) => [e.modelId, e.name, e.totalMs])).toEqual([
      ['a', 'a', 0],
      ['z', 'Zed', 1000],
    ]);
    expect(stats.summary.equipmentCount).toBe(2);
  });

  it('장비 충돌 관여 수는 modelIds 로 센다 — 없는 충돌은 아무도, 같은 id 쌍은 한 번', () => {
    const stats = computePlay3dStats(
      input({
        statusTransitions: [
          { atMs: 0, modelId: 'a', from: 'unknown', to: 'running' },
          { atMs: 0, modelId: 'b', from: 'unknown', to: 'running' },
        ],
        events: [
          ev('collision', 1000, 'a|b', { modelIds: ['a', 'b'] }),
          ev('collision', 2000, 'a|b', { modelIds: ['b', 'a'] }),
          ev('collision', 3000, 'a|a', { modelIds: ['a', 'a'] }),
          ev('collision', 4000, 'x|y'),
          ev('collision', 5000, 'a|c', { modelIds: ['a', 'c'] }),
        ],
      }),
    );
    const byId = Object.fromEntries(
      stats.equipment.map((e) => [e.modelId, e.collisions]),
    );
    expect(byId).toEqual({ a: 4, b: 2 });
    expect(stats.collisions.count).toBe(5);
  });

  it('장비 영역 체류·진입은 띠 배정 규칙과 같다 — 침범자 행, 없으면 소유자 행, 둘 다 없으면 버림', () => {
    const tr = (modelId: string) => ({
      atMs: 0,
      modelId,
      from: 'unknown' as const,
      to: 'running' as const,
    });
    const z = (zoneKey: string, ownerId: string, intruderId: string) => ({
      zoneKey,
      ownerId,
      intruderId,
    });
    const events = [
      // 침범자 c 가 행 → c 에 배정
      ev('zoneEnter', 1000, 'o#z|c', z('o#z', 'o', 'c')),
      ev('zoneExit', 3000, 'o#z|c', z('o#z', 'o', 'c')),
      // 침범자 s(정적)는 행이 아님 → 소유자 o 에 배정, 미이탈은 창 끝까지
      ev('zoneEnter', 5000, 'o#z|s', z('o#z', 'o', 's')),
      // 둘 다 행이 아님 → 버림(영역 합계에는 남는다)
      ev('zoneEnter', 6000, 'q#z|s', z('q#z', 'q', 's')),
    ];
    const stats = computePlay3dStats(
      input({
        events,
        windowEndMs: 8000,
        statusTransitions: [tr('c'), tr('o')],
      }),
    );
    const byId = Object.fromEntries(
      stats.equipment.map((e) => [e.modelId, [e.zoneEnters, e.zoneDwellMs]]),
    );
    expect(byId).toEqual({ c: [1, 2000], o: [1, 3000] });
    expect(stats.zones.dwellMs).toBe(2000 + 3000 + 2000);
    expect(stats.zones.maxDwellMs).toBe(5000);
  });

  it('창 밖 사건은 장비 충돌·체류·summary 에도 들어가지 않는다', () => {
    const stats = computePlay3dStats(
      input({
        windowEndMs: 500,
        statusTransitions: [
          { atMs: 0, modelId: 'a', from: 'unknown', to: 'running' },
        ],
        events: [
          ev('collision', 1000, 'a|b', { modelIds: ['a', 'b'] }),
          ev('zoneEnter', 2000, 'o#z|a', {
            zoneKey: 'o#z',
            ownerId: 'o',
            intruderId: 'a',
          }),
          ev('offlineEnter', 3000, 'a'),
        ],
      }),
    );
    expect(stats.equipment[0]).toMatchObject({
      collisions: 0,
      zoneEnters: 0,
      zoneDwellMs: 0,
      offlineEpisodes: 0,
    });
    expect(stats.summary.offlineEpisodes).toBe(0);
    expect(stats.zones.dwellMs).toBe(0);
  });

  it('zones: dwellMs 합·maxDwellMs, byIntruder 는 횟수 내림차순·동률은 먼저 본 순서', () => {
    const z1 = { zoneKey: 'm#1', zoneName: 'Z1' };
    const z2 = { zoneKey: 'm#2', zoneName: 'Z2' };
    const events = [
      ev('zoneEnter', 0, 'm#1|x', { ...z1, intruderId: 'x' }),
      ev('zoneExit', 1000, 'm#1|x', { ...z1, intruderId: 'x' }),
      ev('zoneEnter', 0, 'm#1|y', { ...z1, intruderId: 'y' }),
      ev('zoneExit', 3000, 'm#1|y', { ...z1, intruderId: 'y' }),
      ev('zoneEnter', 4000, 'm#1|y', { ...z1, intruderId: 'y' }),
      ev('zoneExit', 5000, 'm#1|y', { ...z1, intruderId: 'y' }),
      ev('zoneEnter', 0, 'm#2|w', { ...z2, intruderId: 'w' }),
      ev('zoneExit', 500, 'm#2|w', { ...z2, intruderId: 'w' }),
    ];
    const stats = computePlay3dStats(input({ events, windowEndMs: 10_000 }));
    expect(stats.zones.dwellMs).toBe(5500);
    expect(stats.zones.maxDwellMs).toBe(5000);
    expect(
      stats.zones.byZone[0].byIntruder.map((r) => [r.intruderId, r.count]),
    ).toEqual([
      ['y', 2],
      ['x', 1],
    ]);
    const tie = computePlay3dStats(
      input({
        events: [
          ev('zoneEnter', 0, 'm#1|x', { ...z1, intruderId: 'x' }),
          ev('zoneEnter', 0, 'm#1|y', { ...z1, intruderId: 'y' }),
        ],
      }),
    );
    expect(tie.zones.byZone[0].byIntruder.map((r) => r.intruderId)).toEqual([
      'x',
      'y',
    ]);
  });

  it('태그: 평균과 포화 비율(검사 시간 대비, 1 상한, 한계 없으면 null)', () => {
    const a = createTagAggregate('a', true);
    a.sum = 30;
    a.count = 3;
    a.saturatedMs = 5000;
    const b = createTagAggregate('b', false);
    const stats = computePlay3dStats(
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
    const stats = computePlay3dStats(
      input({ windowEndMs: Number.NaN, scenarioDurationMs: 1000 }),
    );
    expect(stats.windowEndMs).toBe(0);
    expect(stats.loopIteration).toBe(0);
    expect(
      computePlay3dStats(input({ windowEndMs: 2500, scenarioDurationMs: 1000 }))
        .loopIteration,
    ).toBe(2);
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

describe('시간 축 파생 — zoneBands', () => {
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

  it('ownerId 를 밴드에 넘긴다(없으면 undefined)', () => {
    const bands = zoneBands(
      [
        ev('zoneEnter', 1000, 'm#z|c', { ...zone, ownerId: 'm' }),
        ev('zoneEnter', 2000, 'n#z|c', { ...zone, zoneKey: 'n#z' }),
      ],
      4000,
    );
    expect(bands[0].ownerId).toBe('m');
    expect(bands[1].ownerId).toBeUndefined();
  });

  it('enterId 는 그 체류를 연 진입 사건의 id — 중복 진입으로 닫힌 밴드도 자기 id', () => {
    const first = ev('zoneEnter', 1000, 'm#z|c', zone);
    const second = ev('zoneEnter', 2000, 'm#z|c', zone);
    const exit = ev('zoneExit', 3000, 'm#z|c', zone);
    const bands = zoneBands([first, second, exit], 5000);
    expect(bands.map((b) => [b.enterId, b.fromMs, b.toMs])).toEqual([
      [first.id, 1000, 2000],
      [second.id, 2000, 3000],
    ]);
  });
});

describe('assignZoneBandsToRows', () => {
  const band = (patch: Partial<ZoneBand>): ZoneBand => ({
    enterId: 1,
    fromMs: 0,
    toMs: 1000,
    zoneKey: 'o#z',
    zoneName: 'Z',
    level: 'warn',
    ownerId: 'o',
    intruderId: 'c',
    intruderName: 'C',
    open: false,
    ...patch,
  });

  it('침범자가 행이면 침범자 행, 아니면 소유자 행, 둘 다 아니면 버린다', () => {
    const rows = assignZoneBandsToRows(
      [
        band({ intruderId: 'c' }),
        band({ intruderId: 's' }),
        band({ intruderId: 's', ownerId: 'q' }),
        band({ intruderId: 's', ownerId: undefined }),
      ],
      new Set(['c', 'o']),
    );
    expect([...rows.keys()]).toEqual(['c', 'o']);
    expect(rows.get('c')).toHaveLength(1);
    expect(rows.get('o')).toHaveLength(1);
  });

  it('열린 밴드도 그대로 배정되고 같은 행의 밴드는 입력 순서를 유지한다', () => {
    const first = band({ fromMs: 0, toMs: 500, open: true });
    const second = band({ fromMs: 800, toMs: 900 });
    const rows = assignZoneBandsToRows([first, second], new Set(['c']));
    expect(rows.get('c')).toEqual([first, second]);
  });

  it('빈 밴드·빈 행 집합은 빈 Map', () => {
    expect(assignZoneBandsToRows([], new Set(['c'])).size).toBe(0);
    expect(assignZoneBandsToRows([band({})], new Set()).size).toBe(0);
  });

  it('intruderId 가 zoneKey(영역↔영역)면 소유자 행으로 간다', () => {
    const rows = assignZoneBandsToRows(
      [band({ intruderId: 'p#z', ownerId: 'o' })],
      new Set(['o', 'p']),
    );
    expect([...rows.keys()]).toEqual(['o']);
  });
});

describe('range bar', () => {
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

describe('assignCollisionsToRows / collisionSummaries', () => {
  it('assignCollisionsToRows: 양쪽이 행이면 두 행, 한쪽만 행이면 한 행, 둘 다 아니면 버림 — 입력 순서 유지', () => {
    const both = ev('collision', 1000, 'a|b', { modelIds: ['a', 'b'] });
    const one = ev('collision', 2000, 'a|s', { modelIds: ['a', 's'] });
    const none = ev('collision', 3000, 's|t', { modelIds: ['s', 't'] });
    const later = ev('collision', 500, 'a|b', { modelIds: ['b', 'a'] });
    const rows = assignCollisionsToRows(
      [both, one, none, later],
      new Set(['a', 'b']),
    );
    expect([...rows.keys()]).toEqual(['a', 'b']);
    expect(rows.get('a')).toEqual([both, one, later]);
    expect(rows.get('b')).toEqual([both, later]);
  });

  it('assignCollisionsToRows: modelIds 없음·같은 id 쌍은 한 번·충돌 아닌 사건 무시·빈 입력은 빈 Map', () => {
    const rows = assignCollisionsToRows(
      [
        ev('collision', 1000, 'x|y'),
        ev('collision', 2000, 'a|a', { modelIds: ['a', 'a'] }),
        ev('zoneEnter', 3000, 'a#z|b', { modelIds: ['a', 'b'] }),
      ],
      new Set(['a', 'b']),
    );
    expect([...rows.keys()]).toEqual(['a']);
    expect(rows.get('a')).toHaveLength(1);
    expect(assignCollisionsToRows([], new Set(['a'])).size).toBe(0);
    expect(
      assignCollisionsToRows(
        [ev('collision', 1, 'a|b', { modelIds: ['a', 'b'] })],
        new Set(),
      ).size,
    ).toBe(0);
  });

  it('computePlay3dStats: 장비 충돌 값은 assignCollisionsToRows 와 같은 규칙이다', () => {
    const events = [
      ev('collision', 1000, 'a|b', { modelIds: ['a', 'b'] }),
      ev('collision', 2000, 'a|s', { modelIds: ['a', 's'] }),
      ev('collision', 3000, 'x|y'),
    ];
    const stats = computePlay3dStats(
      input({
        events,
        statusTransitions: [
          { atMs: 0, modelId: 'a', from: 'unknown', to: 'running' },
          { atMs: 0, modelId: 'b', from: 'unknown', to: 'running' },
        ],
      }),
    );
    const rows = assignCollisionsToRows(stats.events, new Set(['a', 'b']));
    for (const eq of stats.equipment) {
      expect(eq.collisions).toBe(rows.get(eq.modelId)?.length ?? 0);
    }
    expect(stats.equipment.map((e) => e.collisions)).toEqual([2, 1]);
  });

  it('collisionSummaries: 쌍별 순번·전체 — 같은 시각은 id 순, 다른 쌍은 독립, 시각순이 아닌 입력도 시각 기준', () => {
    const late = ev('collision', 5000, 'a|b');
    const early = ev('collision', 1000, 'a|b');
    const tieA = ev('collision', 3000, 'a|b');
    const tieB = ev('collision', 3000, 'a|b');
    const other = ev('collision', 2000, 'c|d');
    const map = collisionSummaries([late, early, tieA, tieB, other]);
    expect(map.get(early.id)).toEqual({ ordinal: 1, total: 4 });
    expect(map.get(tieA.id)).toEqual({ ordinal: 2, total: 4 });
    expect(map.get(tieB.id)).toEqual({ ordinal: 3, total: 4 });
    expect(map.get(late.id)).toEqual({ ordinal: 4, total: 4 });
    expect(map.get(other.id)).toEqual({ ordinal: 1, total: 1 });
  });

  it('collisionSummaries: 충돌 아닌 사건·NaN 시각은 빼고, 빈 입력은 빈 Map', () => {
    const broken = ev('collision', Number.NaN, 'a|b');
    const zone = ev('zoneEnter', 1000, 'a|b');
    const ok = ev('collision', 1000, 'a|b');
    const map = collisionSummaries([broken, zone, ok]);
    expect(map.size).toBe(1);
    expect(map.get(ok.id)).toEqual({ ordinal: 1, total: 1 });
    expect(collisionSummaries([]).size).toBe(0);
  });
});

describe('lastEventAtMs', () => {
  it('lastEventAtMs: 마지막 원소가 아니라 최댓값 — 빈 배열·NaN·음수는 0', () => {
    expect(
      lastEventAtMs([
        ev('collision', 5000, 'a'),
        ev('collision', 1000, 'a'),
        ev('collision', Number.NaN, 'a'),
      ]),
    ).toBe(5000);
    expect(lastEventAtMs([])).toBe(0);
    expect(lastEventAtMs([ev('collision', Number.NaN, 'a')])).toBe(0);
    expect(lastEventAtMs([ev('collision', -10, 'a')])).toBe(0);
  });
});

describe('reachedMs — 시간 축 앵커 passthrough', () => {
  it('그대로 내놓고, 생략·NaN·음수·Infinity 는 0', () => {
    expect(computePlay3dStats(input({ reachedMs: 25_000 })).reachedMs).toBe(
      25_000,
    );
    expect(computePlay3dStats(input()).reachedMs).toBe(0);
    expect(computePlay3dStats(input({ reachedMs: 0 })).reachedMs).toBe(0);
    expect(computePlay3dStats(input({ reachedMs: Number.NaN })).reachedMs).toBe(
      0,
    );
    expect(computePlay3dStats(input({ reachedMs: -1 })).reachedMs).toBe(0);
    expect(computePlay3dStats(input({ reachedMs: Infinity })).reachedMs).toBe(
      0,
    );
  });
  it('창(windowEndMs)보다 커도 줄이지 않는다 — 뒤로 seek 한 상태', () => {
    const stats = computePlay3dStats(
      input({ windowEndMs: 10_000, reachedMs: 60_000 }),
    );
    expect(stats.reachedMs).toBe(60_000);
    expect(stats.windowEndMs).toBe(10_000);
  });
});

describe('allEvents — 실행 전체 원시 사건 passthrough', () => {
  it('창 뒤 사건을 포함해 입력 참조 그대로(정렬·복사 없음), 창 안 사건과 별개', () => {
    const late = ev('collision', 90_000, 'a|b');
    const early = ev('collision', 1000, 'a|b');
    const events = [late, early];
    const stats = computePlay3dStats(input({ events, windowEndMs: 5000 }));
    expect(stats.allEvents).toBe(events);
    expect(stats.events).toEqual([early]);
  });
});

describe('로그 기준 판정 — zoneLogStateAt / openZoneSubjectsAt', () => {
  const zone = {
    zoneKey: 'm#z',
    zoneName: 'Z',
    intruderId: 'c',
    intruderName: 'C',
  };

  it('zoneLogStateAt: t 이하 마지막 사건(경계 ≤ 포함) — 다른 subject·영역 아닌 사건·NaN 은 무시, 빈 로그·앞은 null', () => {
    const enter = ev('zoneEnter', 1000, 'm#z|c', zone);
    const exit = ev('zoneExit', 3000, 'm#z|c', zone);
    const other = ev('zoneEnter', 2000, 'm#z|d', { ...zone, intruderId: 'd' });
    const hold = ev('holdStart', 2500, 'm#z|c');
    const broken = ev('zoneExit', Number.NaN, 'm#z|c', zone);
    const log = [exit, hold, other, enter, broken];
    expect(zoneLogStateAt(log, 'm#z|c', 999)).toBeNull();
    expect(zoneLogStateAt(log, 'm#z|c', 1000)).toBe(enter);
    expect(zoneLogStateAt(log, 'm#z|c', 2999)).toBe(enter);
    expect(zoneLogStateAt(log, 'm#z|c', 3000)).toBe(exit);
    expect(zoneLogStateAt([], 'm#z|c', 5000)).toBeNull();
  });

  it('zoneLogStateAt: 같은 시각이면 id 가 큰 쪽(나중 기록)', () => {
    const a = ev('zoneEnter', 1000, 'm#z|c', zone);
    const b = ev('zoneExit', 1000, 'm#z|c', zone);
    expect(zoneLogStateAt([b, a], 'm#z|c', 1000)).toBe(b);
  });

  it('openZoneSubjectsAt: t 에 안에 있는 subject → 그 진입 사건', () => {
    const e1 = ev('zoneEnter', 1000, 'm#z|c', zone);
    const x1 = ev('zoneExit', 3000, 'm#z|c', zone);
    const e2 = ev('zoneEnter', 2000, 'm#z|d', { ...zone, intruderId: 'd' });
    const log = [e1, x1, e2];
    expect([...openZoneSubjectsAt(log, 2500).entries()]).toEqual([
      ['m#z|c', e1],
      ['m#z|d', e2],
    ]);
    expect([...openZoneSubjectsAt(log, 3000).keys()]).toEqual(['m#z|d']);
    expect(openZoneSubjectsAt(log, 500).size).toBe(0);
    expect(openZoneSubjectsAt([], 500).size).toBe(0);
  });
});

describe('decideZoneEvent — seek 는 로그를 바꾸지 않는다', () => {
  const zone = {
    zoneKey: 'm#z',
    zoneName: 'Z',
    intruderId: 'c',
    intruderName: 'C',
  };
  const S = 'm#z|c';
  const J = REPASS_JITTER_MS;

  it('진입: 로그가 밖이면 push, 안이면 skip. NaN 은 skip', () => {
    const enter = ev('zoneEnter', 1000, S, zone);
    expect(decideZoneEvent([], 'zoneEnter', S, 500)).toEqual({
      action: 'push',
    });
    expect(decideZoneEvent([enter], 'zoneEnter', S, 1000)).toEqual({
      action: 'skip',
    });
    expect(decideZoneEvent([enter], 'zoneEnter', S, Number.NaN)).toEqual({
      action: 'skip',
    });
  });

  it('진입: 뒤 진입이 jitter 안이면 앞당김(replace) — 정확값은 replace, +1 은 push', () => {
    const later = ev('zoneEnter', 10_000, S, zone);
    expect(decideZoneEvent([later], 'zoneEnter', S, 10_000 - J)).toEqual({
      action: 'replace',
      id: later.id,
    });
    expect(decideZoneEvent([later], 'zoneEnter', S, 10_000 - J - 1)).toEqual({
      action: 'push',
    });
  });

  it('진입: 뒤 진입이 잠정이면 jitter 밖이어도 replace, 다른 subject 는 무관', () => {
    const prov = ev('zoneEnter', 40_000, S, { ...zone, provisional: true });
    const other = ev('zoneEnter', 30_500, 'm#z|d', {
      ...zone,
      intruderId: 'd',
    });
    expect(decideZoneEvent([prov, other], 'zoneEnter', S, 30_000)).toEqual({
      action: 'replace',
      id: prov.id,
    });
  });

  it('이탈: 로그가 안이면 뒤 사건 없음→push·잠정 이탈→replace·실제 사건→skip. 밖이면 skip, 단 잠정 이탈 뒤면 그 이탈을 미룸', () => {
    const enter = ev('zoneEnter', 1000, S, zone);
    expect(decideZoneEvent([enter], 'zoneExit', S, 2000)).toEqual({
      action: 'push',
    });
    const provExit = ev('zoneExit', 5000, S, { ...zone, provisional: true });
    expect(decideZoneEvent([enter, provExit], 'zoneExit', S, 2000)).toEqual({
      action: 'replace',
      id: provExit.id,
    });
    const realExit = ev('zoneExit', 5000, S, zone);
    expect(decideZoneEvent([enter, realExit], 'zoneExit', S, 2000)).toEqual({
      action: 'skip',
    });
    const reenter = ev('zoneEnter', 4000, S, zone);
    expect(decideZoneEvent([enter, reenter], 'zoneExit', S, 2000)).toEqual({
      action: 'skip',
    });
    // 로그가 밖
    expect(decideZoneEvent([], 'zoneExit', S, 2000)).toEqual({
      action: 'skip',
    });
    expect(decideZoneEvent([enter, realExit], 'zoneExit', S, 6000)).toEqual({
      action: 'skip',
    });
    expect(decideZoneEvent([enter, provExit], 'zoneExit', S, 6000)).toEqual({
      action: 'replace',
      id: provExit.id,
    });
  });

  it('추적 (1): 닫힌 띠 안으로 되돌아온 뒤 재통과 — 아무것도 넣지 않는다', () => {
    const enter = ev('zoneEnter', 10_000, S, zone);
    const exit = ev('zoneExit', 20_000, S, zone);
    const log = [enter, exit];
    // 정착 화해(런타임 안, 15s)
    expect(decideZoneEvent(log, 'zoneEnter', S, 15_000)).toEqual({
      action: 'skip',
    });
    for (const t of [19_900, 20_000, 20_100]) {
      expect(decideZoneEvent(log, 'zoneExit', S, t)).toEqual({
        action: 'skip',
      });
    }
    expect(zoneBands(log, 25_000).map((b) => [b.fromMs, b.toMs])).toEqual([
      [10_000, 20_000],
    ]);
  });

  it('추적 (2): 열린 띠에서 뒤로 seek → 화해 없음, 재통과 진입은 앞당김/skip, 이탈은 push', () => {
    const enter = ev('zoneEnter', 20_000, S, zone);
    const log = [enter];
    expect(decideZoneEvent(log, 'zoneExit', S, 5000)).toEqual({
      action: 'skip',
    });
    expect(decideZoneEvent(log, 'zoneEnter', S, 19_900)).toEqual({
      action: 'replace',
      id: enter.id,
    });
    expect(decideZoneEvent(log, 'zoneEnter', S, 20_000)).toEqual({
      action: 'skip',
    });
    expect(decideZoneEvent(log, 'zoneEnter', S, 20_100)).toEqual({
      action: 'skip',
    });
    expect(decideZoneEvent(log, 'zoneExit', S, 28_000)).toEqual({
      action: 'push',
    });
  });

  it('추적 (3): 앞으로 점프한 잠정 이탈은 실제 이탈이 교체하고(지나쳐도 미룸), 잠정 진입은 실제 진입이 앞당긴다', () => {
    const enter = ev('zoneEnter', 20_000, S, zone);
    const provExit = ev('zoneExit', 40_000, S, { ...zone, provisional: true });
    expect(decideZoneEvent([enter, provExit], 'zoneExit', S, 33_000)).toEqual({
      action: 'replace',
      id: provExit.id,
    });
    expect(decideZoneEvent([enter, provExit], 'zoneExit', S, 45_000)).toEqual({
      action: 'replace',
      id: provExit.id,
    });
    const provEnter = ev('zoneEnter', 40_000, S, {
      ...zone,
      provisional: true,
    });
    expect(decideZoneEvent([provEnter], 'zoneEnter', S, 30_000)).toEqual({
      action: 'replace',
      id: provEnter.id,
    });
    expect(decideZoneEvent([provEnter], 'zoneExit', S, 50_000)).toEqual({
      action: 'push',
    });
  });

  it('짧은 두 체류의 자기치유 — 첫 통과가 늦게 시작해 두 번째 진입만 있을 때(jitter 안) 재통과가 앞 체류를 복원한다', () => {
    // 진실 enter@10 exit@10.5 enter@11 exit@15, 첫 통과는 10.7s 부터라 로그엔 enter@11 만.
    const second = ev('zoneEnter', 11_000, S, zone);
    const log: Play3dEvent[] = [second];
    expect(decideZoneEvent(log, 'zoneEnter', S, 10_000)).toEqual({
      action: 'replace',
      id: second.id,
    });
    second.atMs = 10_000;
    expect(decideZoneEvent(log, 'zoneExit', S, 10_500)).toEqual({
      action: 'push',
    });
    log.push(ev('zoneExit', 10_500, S, zone));
    expect(decideZoneEvent(log, 'zoneEnter', S, 11_000)).toEqual({
      action: 'push',
    });
    log.push(ev('zoneEnter', 11_000, S, zone));
    expect(decideZoneEvent(log, 'zoneExit', S, 15_000)).toEqual({
      action: 'push',
    });
    log.push(ev('zoneExit', 15_000, S, zone));
    expect(zoneBands(log, 20_000).map((b) => [b.fromMs, b.toMs])).toEqual([
      [10_000, 10_500],
      [11_000, 15_000],
    ]);
  });
});

describe('hasEventNear — 충돌 재통과 중복', () => {
  it('같은 종류·subject 가 ±tol 안(경계 포함)이면 true — 밖·다른 종류·다른 subject·NaN·빈 로그는 false', () => {
    const c = ev('collision', 10_000, 'a|b');
    expect(hasEventNear([c], 'collision', 'a|b', 11_500, 1500)).toBe(true);
    expect(hasEventNear([c], 'collision', 'a|b', 8500, 1500)).toBe(true);
    expect(hasEventNear([c], 'collision', 'a|b', 11_501, 1500)).toBe(false);
    expect(hasEventNear([c], 'collision', 'a|c', 10_000, 1500)).toBe(false);
    expect(hasEventNear([c], 'holdStart', 'a|b', 10_000, 1500)).toBe(false);
    expect(hasEventNear([c], 'collision', 'a|b', Number.NaN, 1500)).toBe(false);
    expect(hasEventNear([], 'collision', 'a|b', 10_000, 1500)).toBe(false);
  });
});
