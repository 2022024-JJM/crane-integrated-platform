import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import type { SceneCollisionRecord } from '../../model/use-scene-collision-store';
import { toCollisionJournalEntries } from '../collision-journal-map';

function sceneWithModels(modelIds: string[]): SavedSceneInfo {
  return {
    models: modelIds.map((id) => ({ id })),
  } as unknown as SavedSceneInfo;
}

function record(overrides: Partial<SceneCollisionRecord> = {}) {
  return {
    id: 1,
    pairKey: 'goliath|llc',
    at: 1757400000000,
    a: { modelId: 'goliath', equipName: 'Goliath Crane', nodePath: '' },
    b: { modelId: 'llc', equipName: 'LLC-002', nodePath: '[0]LLC' },
    contactPoint: [-640, 12, 100] as [number, number, number],
    values: [['goliath/map-1', 3.5]] as SceneCollisionRecord['values'],
    ...overrides,
  } satisfies SceneCollisionRecord;
}

describe('toCollisionJournalEntries', () => {
  it('record 를 축약 변환한다 — values 자세 스냅샷과 nodePath 는 버린다', () => {
    const [entry] = toCollisionJournalEntries([record()], {
      'philly-dock-2': sceneWithModels(['goliath', 'llc']),
    });
    expect(entry).toEqual({
      key: '1757400000000:goliath|llc',
      at: 1757400000000,
      pairKey: 'goliath|llc',
      regionId: 'philly-dock-2',
      a: { modelId: 'goliath', equipName: 'Goliath Crane' },
      b: { modelId: 'llc', equipName: 'LLC-002' },
      contactPoint: [-640, 12, 100],
    });
    expect('values' in entry).toBe(false);
    expect('nodePath' in entry.a).toBe(false);
  });

  it('a 의 modelId 가 없는 region 은 b 로 폴백해 스탬프한다', () => {
    const [entry] = toCollisionJournalEntries([record()], {
      goliath: sceneWithModels(['other']),
      'philly-dock-2': sceneWithModels(['llc']),
    });
    expect(entry.regionId).toBe('philly-dock-2');
  });

  it('어느 씬에도 없으면 regionId 는 null (에디터 씬 등)', () => {
    const [entry] = toCollisionJournalEntries([record()], {
      'dock-1': sceneWithModels(['unrelated']),
    });
    expect(entry.regionId).toBeNull();
  });

  it('씬 정보가 비어 있어도 변환은 성공한다', () => {
    const [entry] = toCollisionJournalEntries([record()], {});
    expect(entry.regionId).toBeNull();
    expect(entry.key).toBe('1757400000000:goliath|llc');
  });

  it('빈 records 는 빈 배열', () => {
    expect(toCollisionJournalEntries([], {})).toEqual([]);
  });
});
