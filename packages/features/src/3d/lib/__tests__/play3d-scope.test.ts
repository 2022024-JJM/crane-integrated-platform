import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { RuntimeStatusRecord } from '../model-runtime-status';
import {
  isCollisionExcluded,
  omitRuntimeStatuses,
  reportExcludedModelIds,
} from '../play3d-scope';

describe('reportExcludedModelIds', () => {
  it('reportExcludedModelIds: zoneExempt 가 true 인 모델만 — false·누락·오염값은 제외 대상이 아니다', () => {
    const scene = {
      models: [
        { id: 'exempt', zoneExempt: true },
        { id: 'off', zoneExempt: false },
        { id: 'missing' },
        { id: 'dirty', zoneExempt: 'yes' },
        { id: 'one', zoneExempt: 1 },
      ],
    } as unknown as SavedSceneInfo;
    expect([...reportExcludedModelIds(scene)]).toEqual(['exempt']);
  });

  it('reportExcludedModelIds: scene null·undefined·빈 models·배열 속 null·id 가 문자열이 아니면 건너뛴다', () => {
    expect(reportExcludedModelIds(null).size).toBe(0);
    expect(reportExcludedModelIds(undefined).size).toBe(0);
    expect(
      reportExcludedModelIds({ models: [] } as unknown as SavedSceneInfo).size,
    ).toBe(0);
    const dirty = {
      models: [null, { id: 42, zoneExempt: true }, { zoneExempt: true }],
    } as unknown as SavedSceneInfo;
    expect(reportExcludedModelIds(dirty).size).toBe(0);
  });
});

describe('omitRuntimeStatuses', () => {
  const record: RuntimeStatusRecord = {
    a: 'running',
    b: 'idle',
    c: 'unknown',
  };

  it('omitRuntimeStatuses: 제외 모델만 빼고 나머지 상태는 그대로', () => {
    expect(omitRuntimeStatuses(record, new Set(['b']))).toEqual({
      a: 'running',
      c: 'unknown',
    });
    expect(omitRuntimeStatuses(record, new Set(['a', 'b', 'c']))).toEqual({});
  });

  it('omitRuntimeStatuses: 뺄 것이 없으면 같은 참조 — 빈 집합·기록에 없는 id', () => {
    expect(omitRuntimeStatuses(record, new Set())).toBe(record);
    expect(omitRuntimeStatuses(record, new Set(['zzz']))).toBe(record);
    const empty: RuntimeStatusRecord = {};
    expect(omitRuntimeStatuses(empty, new Set(['a']))).toBe(empty);
  });
});

describe('isCollisionExcluded', () => {
  it('isCollisionExcluded: 한쪽이라도 제외 모델이면 true, 둘 다 아니거나 빈 집합이면 false', () => {
    const excluded = new Set(['x']);
    expect(isCollisionExcluded('x', 'a', excluded)).toBe(true);
    expect(isCollisionExcluded('a', 'x', excluded)).toBe(true);
    expect(isCollisionExcluded('x', 'x', excluded)).toBe(true);
    expect(isCollisionExcluded('a', 'b', excluded)).toBe(false);
    expect(isCollisionExcluded('x', 'a', new Set())).toBe(false);
  });
});
