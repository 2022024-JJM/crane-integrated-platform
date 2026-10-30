import { describe, expect, it } from 'vitest';
import {
  compareCraneIds,
  isCraneScope,
  isCraneSnapshot,
  isCraneSnapshotBatch,
  isCraneSnapshotTag,
  parseIsoMs,
  sanitizeCraneSnapshot,
} from '../crane-snapshot';

const VALID = {
  craneId: 'C_867',
  scope: 'indoor',
  stationId: 'isl-ocean-crane',
  bay: 'F5_1_Bay',
  snapshotAt: '2026-10-20T04:21:27.864Z',
  lastReceivedAt: '2026-10-20T04:21:28.831626100Z',
  online: true,
  tags: {
    heartbeat: {
      value: true,
      quality: 0,
      timestamp: '2026-10-20T04:21:27.864Z',
    },
    mh1_weight: {
      value: 1743,
      quality: 0,
      timestamp: '2026-10-20T04:21:27.864Z',
    },
  },
};

describe('isCraneSnapshotTag', () => {
  it('숫자·불리언·null(값 없음)을 받고 문자열·undefined 값은 거부한다', () => {
    expect(isCraneSnapshotTag({ value: 1, quality: 0, timestamp: null })).toBe(
      true,
    );
    expect(
      isCraneSnapshotTag({ value: false, quality: 0, timestamp: 't' }),
    ).toBe(true);
    expect(isCraneSnapshotTag({ value: '1', quality: 0, timestamp: 't' })).toBe(
      false,
    );
    expect(
      isCraneSnapshotTag({ value: null, quality: 0, timestamp: 't' }),
    ).toBe(true);
    // 서버는 값 없음을 JSON null 로만 보낸다 — 문자열 "NULL" 은 깨진 값이다.
    expect(
      isCraneSnapshotTag({ value: 'NULL', quality: 0, timestamp: 't' }),
    ).toBe(false);
    expect(isCraneSnapshotTag({ quality: 0, timestamp: 't' })).toBe(false);
    expect(isCraneSnapshotTag({ value: 1, quality: '0', timestamp: 't' })).toBe(
      false,
    );
    expect(isCraneSnapshotTag({ value: 1, quality: 0 })).toBe(false);
    expect(isCraneSnapshotTag(null)).toBe(false);
    expect(isCraneSnapshotTag([])).toBe(false);
  });
});

describe('isCraneSnapshot / sanitizeCraneSnapshot', () => {
  it('서버 형식을 통과시킨다', () => {
    expect(isCraneSnapshot(VALID)).toBe(true);
    expect(sanitizeCraneSnapshot(VALID)).toEqual(VALID);
  });

  it('외업 스냅샷 — 원본 이름(점) 태그와 값 없음(null)을 그대로 남긴다', () => {
    const outdoor = {
      ...VALID,
      craneId: 'GC_01',
      scope: 'outdoor',
      bay: 'ACS_PLC',
      tags: {
        '4_Crane.4_CR01.4_POS.04_Center_POS_y1': {
          value: 12.5,
          quality: 0,
          timestamp: null,
        },
        '4_Crane.4_CR01.2_slow.52_TL_FW_slow_1': {
          value: null,
          quality: 0,
          timestamp: null,
        },
      },
    };
    expect(sanitizeCraneSnapshot(outdoor)).toEqual(outdoor);
  });

  it('scope 가 없는 옛 JSON 은 indoor 로 읽고, 모르는 scope 는 통째로 거부한다', () => {
    const legacy: Record<string, unknown> = { ...VALID };
    delete legacy.scope;
    expect(isCraneSnapshot(legacy)).toBe(true);
    expect(sanitizeCraneSnapshot(legacy)?.scope).toBe('indoor');
    expect(isCraneSnapshot({ ...VALID, scope: 'yard' })).toBe(false);
    expect(isCraneSnapshot({ ...VALID, scope: null })).toBe(false);
    expect(isCraneSnapshot({ ...VALID, scope: 'INDOOR' })).toBe(false);
    expect(sanitizeCraneSnapshot({ ...VALID, scope: 'yard' })).toBeNull();
  });

  it('stationId·bay·snapshotAt·lastReceivedAt 은 null 을 허용한다', () => {
    const nulls = {
      ...VALID,
      stationId: null,
      bay: null,
      snapshotAt: null,
      lastReceivedAt: null,
    };
    expect(isCraneSnapshot(nulls)).toBe(true);
  });

  it('craneId 가 없거나 비었거나 online 이 불리언이 아니면 거부한다', () => {
    expect(isCraneSnapshot({ ...VALID, craneId: '' })).toBe(false);
    expect(isCraneSnapshot({ ...VALID, craneId: 867 })).toBe(false);
    expect(isCraneSnapshot({ ...VALID, online: 'true' })).toBe(false);
    expect(isCraneSnapshot({ ...VALID, tags: [] })).toBe(false);
    expect(isCraneSnapshot({ ...VALID, tags: null })).toBe(false);
    expect(isCraneSnapshot('C_867')).toBe(false);
  });

  it('sanitize 는 깨진 태그 항목만 버리고 나머지를 남긴다', () => {
    const mixed = {
      ...VALID,
      tags: {
        ...VALID.tags,
        broken: { value: 'x', quality: 0, timestamp: null },
        nothing: null,
      },
    };
    const result = sanitizeCraneSnapshot(mixed);
    expect(result).not.toBeNull();
    expect(Object.keys(result!.tags).sort()).toEqual([
      'heartbeat',
      'mh1_weight',
    ]);
  });

  it('sanitize 는 스냅샷이 아니면 null', () => {
    expect(sanitizeCraneSnapshot(undefined)).toBeNull();
    expect(sanitizeCraneSnapshot({ ...VALID, online: undefined })).toBeNull();
  });

  it('빈 태그 맵은 그대로 통과한다', () => {
    const empty = { ...VALID, tags: {} };
    expect(sanitizeCraneSnapshot(empty)?.tags).toEqual({});
  });
});

describe('isCraneScope', () => {
  it('indoor·outdoor 만 범위다', () => {
    expect(isCraneScope('indoor')).toBe(true);
    expect(isCraneScope('outdoor')).toBe(true);
    expect(isCraneScope('Indoor')).toBe(false);
    expect(isCraneScope('')).toBe(false);
    expect(isCraneScope(undefined)).toBe(false);
    expect(isCraneScope(null)).toBe(false);
  });
});

describe('isCraneSnapshotBatch', () => {
  it('type 이 snapshot 이고 cranes 가 배열이면 통과', () => {
    expect(
      isCraneSnapshotBatch({ type: 'snapshot', sentAt: 'x', cranes: [] }),
    ).toBe(true);
    expect(
      isCraneSnapshotBatch({ type: 'snapshot', sentAt: null, cranes: [VALID] }),
    ).toBe(true);
  });

  it('다른 type · cranes 가 배열이 아닌 것 · 원시값은 거부', () => {
    expect(
      isCraneSnapshotBatch({ type: 'delta', sentAt: 'x', cranes: [] }),
    ).toBe(false);
    expect(
      isCraneSnapshotBatch({ type: 'snapshot', sentAt: 'x', cranes: {} }),
    ).toBe(false);
    expect(
      isCraneSnapshotBatch({ type: 'snapshot', sentAt: 1, cranes: [] }),
    ).toBe(false);
    expect(isCraneSnapshotBatch('snapshot')).toBe(false);
    expect(isCraneSnapshotBatch(null)).toBe(false);
  });
});

describe('parseIsoMs', () => {
  it('ISO 문자열은 epoch ms 로, 나노초 자리도 읽는다', () => {
    expect(parseIsoMs('2026-10-20T04:21:27.864Z')).toBe(
      Date.UTC(2026, 9, 20, 4, 21, 27, 864),
    );
    expect(parseIsoMs('2026-10-20T04:21:28.831626100Z')).toBe(
      Date.UTC(2026, 9, 20, 4, 21, 28, 831),
    );
  });

  it('빈 값·null·못 읽는 문자열은 null', () => {
    expect(parseIsoMs(null)).toBeNull();
    expect(parseIsoMs(undefined)).toBeNull();
    expect(parseIsoMs('')).toBeNull();
    expect(parseIsoMs('yesterday')).toBeNull();
  });
});

describe('compareCraneIds', () => {
  it('끝 숫자 기준으로 정렬해 C_1806 이 C_800 뒤에 온다', () => {
    const ids = ['C_1806', 'C_800', 'C_171', 'C_867', 'C_862'];
    expect(ids.slice().sort(compareCraneIds)).toEqual([
      'C_171',
      'C_800',
      'C_862',
      'C_867',
      'C_1806',
    ]);
  });

  it('숫자가 없는 ID 는 숫자 있는 ID 뒤에 문자열순으로 온다', () => {
    expect(['Z', 'C_2', 'A', 'C_1'].sort(compareCraneIds)).toEqual([
      'C_1',
      'C_2',
      'A',
      'Z',
    ]);
  });

  it('접두어로 묶고 그 안에서 숫자 순 — 외업 타입이 섞이지 않는다', () => {
    const ids = [
      'TC_104',
      'OC_01',
      'GC_03',
      'TTC_02',
      'GC_01',
      'TC_54',
      'CC_51',
    ];
    expect(ids.slice().sort(compareCraneIds)).toEqual([
      'CC_51',
      'GC_01',
      'GC_03',
      'OC_01',
      'TC_54',
      'TC_104',
      'TTC_02',
    ]);
  });

  it('같은 숫자는 문자열 비교로 가른다(안정적인 전순서)', () => {
    expect(compareCraneIds('B_1', 'A_1')).toBeGreaterThan(0);
    expect(compareCraneIds('A_1', 'A_1')).toBe(0);
  });
});
