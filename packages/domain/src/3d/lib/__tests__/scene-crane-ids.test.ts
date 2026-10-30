import { describe, expect, it } from 'vitest';
import { collectSceneCraneIds } from '../scene-crane-ids';
import type { SavedModelInfo } from '../../model/types';

function model(craneId?: unknown): SavedModelInfo {
  return { id: `m-${String(craneId)}`, craneId } as unknown as SavedModelInfo;
}

describe('collectSceneCraneIds', () => {
  it('모델 순서대로, 서버 표기(하이픈 → 밑줄)로 중복 없이', () => {
    expect(
      collectSceneCraneIds({
        models: [
          model('GC-01'),
          model('C_171'),
          model('GC_01'),
          model(' TC-104 '),
          model('C_171'),
        ],
      }),
    ).toEqual(['GC_01', 'C_171', 'TC_104']);
  });

  it('크레인이 없거나 빈 모델은 건너뛴다', () => {
    expect(
      collectSceneCraneIds({
        models: [model(undefined), model(''), model('   '), model('LLC_002')],
      }),
    ).toEqual(['LLC_002']);
  });

  it('씬이 없거나 모델이 없으면 빈 목록', () => {
    expect(collectSceneCraneIds(null)).toEqual([]);
    expect(collectSceneCraneIds(undefined)).toEqual([]);
    expect(collectSceneCraneIds({ models: [] })).toEqual([]);
  });
});
