import { describe, expect, it } from 'vitest';
import type { Alarm } from '@crane/domain/alarm';
import {
  EMPTY_HUD_CONDITIONS,
  alarmConditionLevel,
  buildHudConditions,
  resolveHudElapsed,
  type HudConditionInputs,
} from '../hud-conditions';
import { EMPTY_STATUS_SINCE } from '../status-since';

type ZoneIntrusion = HudConditionInputs['intrusions'][number];

const NOW = 1_700_000_000_000;

const MODELS = [
  { id: 'm1', equipName: 'TC-39', craneId: 'C_1' },
  { id: 'm2', equipName: 'OC-02', craneId: 'C_2' },
  { id: 'm3', equipName: 'CC-02' },
];

function alarm(over: Partial<Alarm> = {}): Alarm {
  return {
    id: 'a1',
    regionId: 'r',
    craneId: 'C_1',
    craneName: 'TC-39 서버 이름',
    severity: 'critical',
    eventType: 'e_stop_on',
    active: true,
    timestamp: new Date(NOW - 60_000).toISOString(),
    ...over,
  };
}

function intrusion(over: Partial<ZoneIntrusion> = {}): ZoneIntrusion {
  return {
    zoneKey: 'm2#z1',
    ownerId: 'm2',
    ownerName: 'OC-02',
    zoneId: 'z1',
    zoneName: '선회 반경',
    color: '#ff0000',
    level: 'stop',
    at: NOW - 30_000,
    intruders: [{ kind: 'model', id: 'm1', name: 'TC-39' }],
    ...over,
  };
}

function inputs(over: Partial<HudConditionInputs> = {}): HudConditionInputs {
  return {
    models: MODELS,
    runtime: {},
    labels: {},
    since: EMPTY_STATUS_SINCE,
    alarms: [],
    intrusions: [],
    held: null,
    collision: null,
    ...over,
  };
}

function alarmIds(row: { primary: { kind: string } } | undefined) {
  const primary = row?.primary;
  return primary && primary.kind === 'alarm' && 'alarms' in primary
    ? (primary.alarms as readonly Alarm[]).map((a) => a.id)
    : [];
}

describe('alarmConditionLevel', () => {
  it('critical·high 는 위험, medium 은 주의, info 는 제외', () => {
    expect(alarmConditionLevel('critical')).toBe('danger');
    expect(alarmConditionLevel('high')).toBe('danger');
    expect(alarmConditionLevel('medium')).toBe('caution');
    expect(alarmConditionLevel('info')).toBeNull();
  });
});

describe('buildHudConditions — 빈 입력', () => {
  it('조건이 없으면 공유 빈 결과를 돌려준다', () => {
    expect(buildHudConditions(inputs())).toBe(EMPTY_HUD_CONDITIONS);
    expect(
      buildHudConditions(
        inputs({
          runtime: { m1: 'running', m2: 'standby', m3: 'unknown' },
          labels: {
            m1: { tone: 'running', bypass: false, freeSwing: true },
          },
          alarms: [alarm({ severity: 'info' })],
        }),
      ),
    ).toBe(EMPTY_HUD_CONDITIONS);
  });
});

describe('buildHudConditions — 운전 상태', () => {
  it('고장은 위험, 통신두절은 주의 — 시각은 tone 전이 기록에서', () => {
    const summary = buildHudConditions(
      inputs({
        runtime: { m1: 'fault', m2: 'offline', m3: 'off' },
        since: { tone: { m1: NOW - 5_000, m2: NOW - 9_000 }, bypass: {} },
      }),
    );
    expect(summary.rows.map((r) => [r.key, r.level, r.primary.kind])).toEqual([
      ['m1', 'danger', 'fault'],
      ['m2', 'caution', 'offline'],
    ]);
    expect(summary.rows[0].primary.since).toBe(NOW - 5_000);
    expect(summary.rows[1].primary.since).toBe(NOW - 9_000);
    expect(summary).toMatchObject({ danger: 1, caution: 1 });
  });

  it('전이 시각이 없거나 NaN 이면 -Infinity — 경과를 모르는 조건', () => {
    const summary = buildHudConditions(
      inputs({
        runtime: { m1: 'fault' },
        since: { tone: { m1: NaN }, bypass: {} },
      }),
    );
    expect(summary.rows[0].primary.since).toBe(Number.NEGATIVE_INFINITY);
  });

  it('Bypass 는 주의이고, 고장과 겹치면 고장이 제목이다', () => {
    const summary = buildHudConditions(
      inputs({
        runtime: { m1: 'fault' },
        labels: { m1: { tone: 'fault', bypass: true, freeSwing: false } },
        since: { tone: { m1: NOW - 1 }, bypass: { m1: NOW - 2 } },
      }),
    );
    expect(summary.rows).toHaveLength(1);
    const [row] = summary.rows;
    expect(row.level).toBe('danger');
    expect(row.primary).toEqual({
      kind: 'fault',
      level: 'danger',
      since: NOW - 1,
    });
    expect(row.others).toEqual([
      { kind: 'bypass', level: 'caution', since: NOW - 2 },
    ]);
    expect(summary).toMatchObject({ danger: 1, caution: 0 });
  });
});

describe('buildHudConditions — 알람', () => {
  it('같은 크레인의 위험·주의 알람은 등급별 한 조건으로 묶이고 info 는 빠진다', () => {
    const summary = buildHudConditions(
      inputs({
        alarms: [
          alarm({ id: 'c1', severity: 'critical' }),
          alarm({ id: 'h1', severity: 'high' }),
          alarm({ id: 'm1', severity: 'medium' }),
          alarm({ id: 'i1', severity: 'info' }),
        ],
      }),
    );
    expect(summary.rows).toHaveLength(1);
    const [row] = summary.rows;
    // 씬 모델에 craneId 가 맞으면 모델 이름·id 를 쓴다.
    expect(row).toMatchObject({ key: 'm1', modelId: 'm1', name: 'TC-39' });
    expect(row.primary).toMatchObject({ kind: 'alarm', level: 'danger' });
    expect(alarmIds(row)).toEqual(['c1', 'h1']);
    expect(row.others).toHaveLength(1);
    expect(row.others[0]).toMatchObject({ kind: 'alarm', level: 'caution' });
  });

  it('영역 침범 로컬 알람과 비활성 알람은 거른다', () => {
    expect(
      buildHudConditions(
        inputs({
          alarms: [
            alarm({ eventType: 'zone_intrusion', severity: 'high' }),
            alarm({ active: false }),
          ],
        }),
      ),
    ).toBe(EMPTY_HUD_CONDITIONS);
  });

  it('씬에 없는 크레인은 crane: 키·modelId null·서버 이름으로 따로 선다', () => {
    const summary = buildHudConditions(
      inputs({ alarms: [alarm({ craneId: 'C_9', craneName: 'GC-9' })] }),
    );
    expect(summary.rows[0]).toMatchObject({
      key: 'crane:C_9',
      modelId: null,
      name: 'GC-9',
    });
  });

  it('craneId 가 모델 id 와 같은 로컬 알람도 그 모델 행에 붙는다', () => {
    const summary = buildHudConditions(
      inputs({ alarms: [alarm({ craneId: 'm3', craneName: 'x' })] }),
    );
    expect(summary.rows[0]).toMatchObject({ key: 'm3', name: 'CC-02' });
  });

  it('조건 시각은 가장 오래된 유효 시각, 알람 순서는 최신 먼저', () => {
    const summary = buildHudConditions(
      inputs({
        alarms: [
          alarm({
            id: 'old',
            timestamp: new Date(NOW - 90_000).toISOString(),
          }),
          alarm({ id: 'bad', timestamp: 'not-a-date' }),
          alarm({
            id: 'new',
            timestamp: new Date(NOW - 10_000).toISOString(),
          }),
        ],
      }),
    );
    expect(summary.rows[0].primary.since).toBe(NOW - 90_000);
    expect(alarmIds(summary.rows[0])).toEqual(['new', 'old', 'bad']);
  });

  it('유효한 시각이 하나도 없으면 -Infinity', () => {
    const summary = buildHudConditions(
      inputs({ alarms: [alarm({ timestamp: '' })] }),
    );
    expect(summary.rows[0].primary.since).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe('buildHudConditions — 영역 침범·충돌', () => {
  it('stop 영역은 위험, 들어간 크레인 행에 소유·영역 이름과 정지 여부가 붙는다', () => {
    const summary = buildHudConditions(
      inputs({
        intrusions: [intrusion()],
        held: { zoneKey: 'm2#z1', intruderId: 'm1', at: NOW },
      }),
    );
    expect(summary.rows).toHaveLength(1);
    expect(summary.rows[0]).toMatchObject({ key: 'm1', level: 'danger' });
    expect(summary.rows[0].primary).toEqual({
      kind: 'zone',
      level: 'danger',
      since: NOW - 30_000,
      zoneKey: 'm2#z1',
      ownerName: 'OC-02',
      zoneName: '선회 반경',
      held: true,
    });
  });

  it('다른 쌍의 정지는 이 행의 held 가 아니다, warn 영역은 주의, 이름 없는 영역은 id', () => {
    const summary = buildHudConditions(
      inputs({
        intrusions: [intrusion({ level: 'warn', zoneName: '' })],
        held: { zoneKey: 'm2#z1', intruderId: 'm3', at: NOW },
      }),
    );
    expect(summary.rows[0].primary).toMatchObject({
      kind: 'zone',
      level: 'caution',
      zoneName: 'z1',
      held: false,
    });
  });

  it('영역↔영역 침범은 들어간 영역의 소유 모델 행에 붙는다', () => {
    const summary = buildHudConditions(
      inputs({
        intrusions: [
          intrusion({
            intruders: [
              { kind: 'zone', id: 'm3#z7', name: 'CC-02 · 작업 반경' },
            ],
          }),
        ],
      }),
    );
    expect(summary.rows[0]).toMatchObject({ key: 'm3', name: 'CC-02' });
  });

  it('침입자가 여럿이면 각자 행이 생긴다', () => {
    const summary = buildHudConditions(
      inputs({
        intrusions: [
          intrusion({
            intruders: [
              { kind: 'model', id: 'm1', name: 'TC-39' },
              { kind: 'model', id: 'm3', name: 'CC-02' },
            ],
          }),
        ],
      }),
    );
    expect(summary.rows.map((r) => r.key).sort()).toEqual(['m1', 'm3']);
    expect(summary.danger).toBe(2);
  });

  it('충돌은 양쪽 장비에 위험으로, 상대 이름을 들고 붙는다', () => {
    const summary = buildHudConditions(
      inputs({
        collision: {
          at: NOW - 2_000,
          a: { modelId: 'm1', equipName: 'TC-39', nodePath: '' },
          b: { modelId: 'm2', equipName: 'OC-02', nodePath: 'jib' },
        },
      }),
    );
    expect(summary.rows.map((r) => r.key).sort()).toEqual(['m1', 'm2']);
    const m1 = summary.rows.find((r) => r.key === 'm1');
    expect(m1?.primary).toEqual({
      kind: 'collision',
      level: 'danger',
      since: NOW - 2_000,
      otherName: 'OC-02',
    });
  });

  it('씬에 없는 모델 id 의 침범은 이름만 들고 modelId null 이다', () => {
    const summary = buildHudConditions(
      inputs({
        intrusions: [
          intrusion({
            intruders: [{ kind: 'model', id: 'ghost', name: '유령' }],
          }),
        ],
      }),
    );
    expect(summary.rows[0]).toMatchObject({
      key: 'ghost',
      modelId: null,
      name: '유령',
    });
  });
});

describe('buildHudConditions — 제목 선택·정렬·요약', () => {
  it('한 크레인 안에서는 충돌 > 영역(정지) > 고장 > 위험 알람 순으로 제목이 된다', () => {
    const summary = buildHudConditions(
      inputs({
        runtime: { m1: 'fault' },
        since: { tone: { m1: NOW }, bypass: {} },
        alarms: [alarm({ timestamp: new Date(NOW).toISOString() })],
        intrusions: [intrusion({ at: NOW })],
        collision: {
          at: NOW - 100_000,
          a: { modelId: 'm1', equipName: 'TC-39', nodePath: '' },
          b: { modelId: 'm2', equipName: 'OC-02', nodePath: '' },
        },
      }),
    );
    const m1 = summary.rows.find((r) => r.key === 'm1');
    expect(m1?.primary.kind).toBe('collision');
    expect(m1?.others.map((c) => c.kind)).toEqual(['zone', 'fault', 'alarm']);
  });

  it('위험이 먼저, 같은 등급은 제목 조건이 최근인 행이 먼저, 요약은 행 수', () => {
    const summary = buildHudConditions(
      inputs({
        runtime: { m1: 'fault', m2: 'offline' },
        since: { tone: { m1: NOW - 100, m2: NOW - 1 }, bypass: {} },
        alarms: [
          alarm({
            craneId: 'm3',
            severity: 'high',
            timestamp: new Date(NOW - 10).toISOString(),
          }),
        ],
      }),
    );
    expect(summary.rows.map((r) => r.key)).toEqual(['m3', 'm1', 'm2']);
    expect(summary).toMatchObject({ danger: 2, caution: 1 });
  });

  it('시각이 같으면 종류 우선순위, 그것도 같으면 키 순', () => {
    const summary = buildHudConditions(
      inputs({
        runtime: { m1: 'fault', m2: 'fault' },
        since: { tone: { m1: NOW, m2: NOW }, bypass: {} },
        collision: {
          at: NOW,
          a: { modelId: 'm3', equipName: 'CC-02', nodePath: '' },
          b: { modelId: 'm2', equipName: 'OC-02', nodePath: '' },
        },
      }),
    );
    // m2·m3 는 충돌이 제목(고장보다 앞) — 둘은 키 순. m1 은 고장이라 뒤.
    expect(summary.rows.map((r) => r.key)).toEqual(['m2', 'm3', 'm1']);
  });

  it('시각을 모르는 조건은 같은 등급의 맨 아래', () => {
    const summary = buildHudConditions(
      inputs({
        runtime: { m1: 'fault', m2: 'fault' },
        since: { tone: { m2: NOW - 50_000 }, bypass: {} },
      }),
    );
    expect(summary.rows.map((r) => r.key)).toEqual(['m2', 'm1']);
  });

  it('입력 배열은 바꾸지 않는다', () => {
    const alarms = [
      alarm({ id: 'old', timestamp: new Date(NOW - 90_000).toISOString() }),
      alarm({ id: 'new', timestamp: new Date(NOW - 10_000).toISOString() }),
    ];
    buildHudConditions(inputs({ alarms }));
    expect(alarms.map((a) => a.id)).toEqual(['old', 'new']);
  });
});

describe('resolveHudElapsed', () => {
  it('1분 미만은 초, 1시간 미만은 분, 그 위는 시간 — 경계 쌍', () => {
    expect(resolveHudElapsed(NOW - 59_999, NOW)).toEqual({
      unit: 'seconds',
      value: 59,
    });
    expect(resolveHudElapsed(NOW - 60_000, NOW)).toEqual({
      unit: 'minutes',
      value: 1,
    });
    expect(resolveHudElapsed(NOW - 3_599_999, NOW)).toEqual({
      unit: 'minutes',
      value: 59,
    });
    expect(resolveHudElapsed(NOW - 3_600_000, NOW)).toEqual({
      unit: 'hours',
      value: 1,
    });
  });

  it('미래 시각은 0초, 시각을 모르면 null', () => {
    expect(resolveHudElapsed(NOW + 5_000, NOW)).toEqual({
      unit: 'seconds',
      value: 0,
    });
    expect(resolveHudElapsed(Number.NEGATIVE_INFINITY, NOW)).toBeNull();
    expect(resolveHudElapsed(NaN, NOW)).toBeNull();
    expect(resolveHudElapsed(NOW, NaN)).toBeNull();
  });
});
