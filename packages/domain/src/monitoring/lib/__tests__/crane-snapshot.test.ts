import { describe, expect, it } from 'vitest';
import {
  compareCraneIds,
  isCraneSnapshot,
  isCraneSnapshotBatch,
  isCraneSnapshotTag,
  parseIsoMs,
  sanitizeCraneSnapshot,
} from '../crane-snapshot';

const VALID = {
  craneId: 'C_867',
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
  it('숫자·불리언 값만 받고 문자열·null 값은 거부한다', () => {
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
    ).toBe(false);
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

  it('같은 숫자는 문자열 비교로 가른다(안정적인 전순서)', () => {
    expect(compareCraneIds('B_1', 'A_1')).toBeGreaterThan(0);
    expect(compareCraneIds('A_1', 'A_1')).toBe(0);
  });
});
