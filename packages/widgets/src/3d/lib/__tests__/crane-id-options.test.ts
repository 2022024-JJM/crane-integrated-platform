import { describe, expect, it } from 'vitest';
import type { CraneRegistryEntry } from '@crane/domain/crane';
import { buildCraneIdOptions, isRegisteredCraneId } from '../crane-id-options';

function entry(
  craneId: string,
  regionId = 'dock-1',
  craneNo?: string,
): CraneRegistryEntry {
  return {
    craneId,
    craneName: craneId,
    craneNo: craneNo ?? craneId.replace('_', '-'),
    regionId,
  };
}

describe('buildCraneIdOptions', () => {
  it('번호 순으로 정렬하고 라벨은 크레인 번호, 설명은 지역', () => {
    expect(
      buildCraneIdOptions([
        entry('C_1806', 'dock-in'),
        entry('C_171'),
        entry('C_800'),
      ]),
    ).toEqual([
      { value: 'C_171', label: 'C-171', description: 'dock-1' },
      { value: 'C_800', label: 'C-800', description: 'dock-1' },
      { value: 'C_1806', label: 'C-1806', description: 'dock-in' },
    ]);
  });

  it('정규화 키가 같은 항목은 첫 것만, 빈 id 는 뺀다, 번호가 비면 id', () => {
    expect(
      buildCraneIdOptions([
        entry('GC-04', 'p', ''),
        entry('GC_04', 'q'),
        entry('', 'r'),
      ]),
    ).toEqual([{ value: 'GC-04', label: 'GC-04', description: 'p' }]);
    expect(buildCraneIdOptions([])).toEqual([]);
  });
});

describe('isRegisteredCraneId', () => {
  const options = buildCraneIdOptions([entry('C_171')]);

  it('정규화 키로 비교한다 — 없거나 빈 값은 false', () => {
    expect(isRegisteredCraneId(options, 'C-171')).toBe(true);
    expect(isRegisteredCraneId(options, 'C_171')).toBe(true);
    expect(isRegisteredCraneId(options, 'GC_04')).toBe(false);
    expect(isRegisteredCraneId(options, undefined)).toBe(false);
    expect(isRegisteredCraneId(options, '')).toBe(false);
  });
});
