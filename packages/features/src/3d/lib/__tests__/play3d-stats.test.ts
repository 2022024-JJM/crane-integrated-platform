import { describe, expect, it } from 'vitest';
import type { EquipmentRuntimeStatus } from '@crane/core/types/status';
import {
  accumulateTagValue,
  addScannedInterval,
  assignZoneBandsToRows,
  computePlay3dStats,
  createTagAggregate,
  emptyStatusMs,
  loopIterationOf,
  statusBands,
  sumScanned,
  tagRangeBar,
  zoneBands,
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
});

describe('assignZoneBandsToRows', () => {
  const band = (patch: Partial<ZoneBand>): ZoneBand => ({
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
