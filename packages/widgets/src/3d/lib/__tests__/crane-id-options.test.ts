import { describe, expect, it } from 'vitest';
import type { CraneSnapshotEntry } from '@crane/features/3d';
import {
  buildCraneIdOptions,
  craneListEmptyReason,
  isListedCraneId,
} from '../crane-id-options';

// bay 는 null 이면 필드 없음 — undefined 를 넘기면 기본값이 적용돼 버린다.
function entry(
  craneId: string,
  bay: string | null = 'A',
  online = true,
): CraneSnapshotEntry {
  return {
    snapshot: {
      craneId,
      ...(bay === null ? {} : { bay }),
      online,
      tags: {},
    },
  } as unknown as CraneSnapshotEntry;
}

const labels = { offline: 'OFF' };

describe('buildCraneIdOptions', () => {
  it('스토어 순서대로, 라벨은 서버 ID 그대로, 설명은 구역', () => {
    const cranes = {
      C_171: entry('C_171', '3 Bay'),
      C_800: entry('C_800', '5 Bay'),
    };
    expect(buildCraneIdOptions(['C_800', 'C_171'], cranes, labels)).toEqual([
      { value: 'C_800', label: 'C_800', description: '5 Bay' },
      { value: 'C_171', label: 'C_171', description: '3 Bay' },
    ]);
  });

  it('오프라인 크레인은 배지를 달고 남는다, 구역이 비면 설명이 없다', () => {
    const cranes = {
      C_1: entry('C_1', null, false),
      C_2: entry('C_2', '  ', true),
    };
    expect(buildCraneIdOptions(['C_1', 'C_2'], cranes, labels)).toEqual([
      { value: 'C_1', label: 'C_1', badge: 'OFF' },
      { value: 'C_2', label: 'C_2' },
    ]);
  });

  it('order 에만 있는 id·빈 id·정규화 키 중복은 건너뛴다', () => {
    const cranes = { 'C-1': entry('C-1'), C_1: entry('C_1') };
    expect(
      buildCraneIdOptions(['C-1', 'C_1', 'ghost', ''], cranes, labels).map(
        (o) => o.value,
      ),
    ).toEqual(['C-1']);
  });

  it('빈 스토어는 빈 배열', () => {
    expect(buildCraneIdOptions([], {}, labels)).toEqual([]);
  });
});

describe('isListedCraneId', () => {
  const options = buildCraneIdOptions(
    ['C_171'],
    { C_171: entry('C_171') },
    labels,
  );

  it('없음·빈 문자열·목록 밖은 false', () => {
    expect(isListedCraneId(options, undefined)).toBe(false);
    expect(isListedCraneId(options, '')).toBe(false);
    expect(isListedCraneId(options, 'GC_04')).toBe(false);
    expect(isListedCraneId([], 'C_171')).toBe(false);
  });

  it('정규화 키(하이픈 ≡ 밑줄)로 맞춘다', () => {
    expect(isListedCraneId(options, 'C_171')).toBe(true);
    expect(isListedCraneId(options, 'C-171')).toBe(true);
  });
});

describe('craneListEmptyReason', () => {
  it('연결돼 있으면 조회 실패 › 아직 없음, 연결 중은 connecting', () => {
    expect(craneListEmptyReason('open', false)).toBe('empty');
    expect(craneListEmptyReason('open', true)).toBe('loadError');
    expect(craneListEmptyReason('connecting', true)).toBe('connecting');
  });

  it('끊김·해제는 disconnected — 조회 실패 여부와 무관', () => {
    expect(craneListEmptyReason('reconnecting', false)).toBe('disconnected');
    expect(craneListEmptyReason('off', true)).toBe('disconnected');
  });
});
