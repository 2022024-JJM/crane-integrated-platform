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
      { m1: 'standby', m2: 'offline', m3: 'running' },
      { m1: 'offline', m2: 'running', m3: 'standby' },
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
        from: 'standby',
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

  it('직전 기록에 없던 모델의 첫 판정은 사건이 아니다', () => {
    expect(
      diffOfflineTransitions(
        {},
        { m1: 'offline', m2: 'running' },
        scene,
        'dock-1',
        1,
      ),
    ).toEqual([]);
  });

  it('같은 상태·두절과 무관한 전환은 사건이 아니다', () => {
    expect(
      diffOfflineTransitions(
        { m1: 'offline', m2: 'running', m3: 'standby', m4: 'off' },
        { m1: 'offline', m2: 'standby', m3: 'fault', m4: 'unknown' },
        scene,
        'dock-1',
        1,
      ),
    ).toEqual([]);
  });

  it('운전 전원을 모르는 멈춘 장비(unknown)의 두절·복귀도 남긴다', () => {
    const entries = diffOfflineTransitions(
      { m1: 'unknown', m2: 'offline' },
      { m1: 'offline', m2: 'unknown' },
      scene,
      'dock-1',
      7,
    );
    expect(entries.map((e) => [e.modelId, e.from, e.to])).toEqual([
      ['m1', 'unknown', 'offline'],
      ['m2', 'offline', 'unknown'],
    ]);
  });

  it('씬이 없어도 id 를 이름으로 남긴다', () => {
    const entries = diffOfflineTransitions(
      { m9: 'running' },
      { m9: 'offline' },
      null,
      'dock-1',
      3,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].equipName).toBe('m9');
  });

  it('다음 기록에서 빠진 모델은 사건을 내지 않는다', () => {
    expect(
      diffOfflineTransitions({ m1: 'offline' }, {}, scene, 'dock-1', 1),
    ).toEqual([]);
  });
});
