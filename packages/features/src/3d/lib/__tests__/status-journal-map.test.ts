import { describe, expect, it } from 'vitest';
import type { SavedSceneInfo } from '@crane/domain/3d';
import { diffOfflineTransitions } from '../status-journal-map';

const scene = {
  maps: [],
  models: [
    { id: 'm1', equipName: 'GC-04' },
    { id: 'm2', equipName: '' },
  ],
} as unknown as SavedSceneInfo;

describe('diffOfflineTransitions', () => {
  it('offline 진입·복귀만 남기고 이름은 equipName, 없으면 id', () => {
    const entries = diffOfflineTransitions(
      { m1: 'idle', m2: 'offline', m3: 'running' },
      { m1: 'offline', m2: 'running', m3: 'idle' },
      scene,
      'dock-1',
      500,
    );
    expect(entries).toEqual([
      {
        key: '500:m1:offline',
        at: 500,
        regionId: 'dock-1',
        modelId: 'm1',
        equipName: 'GC-04',
        from: 'idle',
        to: 'offline',
      },
      {
        key: '500:m2:running',
        at: 500,
        regionId: 'dock-1',
        modelId: 'm2',
        equipName: 'm2',
        from: 'offline',
        to: 'running',
      },
    ]);
  });

  it('unknown 에서의 첫 판정·같은 상태·가동↔대기는 사건이 아니다', () => {
    expect(
      diffOfflineTransitions(
        {},
        { m1: 'offline', m2: 'running' },
        scene,
        'dock-1',
        1,
      ),
    ).toEqual([]);
    expect(
      diffOfflineTransitions(
        { m1: 'offline', m2: 'running' },
        { m1: 'offline', m2: 'idle' },
        scene,
        'dock-1',
        1,
      ),
    ).toEqual([]);
  });
});
