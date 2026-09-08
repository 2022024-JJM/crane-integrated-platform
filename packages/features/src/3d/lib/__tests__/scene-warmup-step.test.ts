import { describe, expect, it } from 'vitest';
import {
  selectSceneWarmupStep,
  type SceneWarmupInput,
} from '../scene-warmup-step';

function input(overrides: Partial<SceneWarmupInput> = {}): SceneWarmupInput {
  return {
    bvh: { pending: 0, done: 0, total: 0 },
    collisionBaselinePending: false,
    assetsActive: false,
    assetsLoaded: 0,
    assetsTotal: 0,
    ...overrides,
  };
}

describe('selectSceneWarmupStep — 우선순위', () => {
  it('전부 비활성이면 null', () => {
    expect(selectSceneWarmupStep(input())).toBeNull();
  });

  it('BVH 가 남아 있으면 다른 신호보다 먼저 보인다', () => {
    expect(
      selectSceneWarmupStep(
        input({
          bvh: { pending: 2, done: 3, total: 5 },
          collisionBaselinePending: true,
          assetsActive: true,
        }),
      ),
    ).toEqual({ kind: 'bvh', done: 3, total: 5 });
  });

  it('BVH 가 끝나면 충돌 기준선이 에셋보다 먼저다', () => {
    expect(
      selectSceneWarmupStep(
        input({ collisionBaselinePending: true, assetsActive: true }),
      ),
    ).toEqual({ kind: 'collision' });
  });

  it('에셋만 활성이면 assets', () => {
    expect(
      selectSceneWarmupStep(
        input({ assetsActive: true, assetsLoaded: 4, assetsTotal: 9 }),
      ),
    ).toEqual({ kind: 'assets', loaded: 4, total: 9 });
  });
});

describe('selectSceneWarmupStep — 수치 방어', () => {
  it('bvh pending 이 0 이하·NaN 이면 활성으로 보지 않는다', () => {
    expect(
      selectSceneWarmupStep(input({ bvh: { pending: -1, done: 0, total: 0 } })),
    ).toBeNull();
    expect(
      selectSceneWarmupStep(
        input({ bvh: { pending: Number.NaN, done: 0, total: 0 } }),
      ),
    ).toBeNull();
  });

  it('표시 수치는 정수로 내림하고 NaN·음수·Infinity 는 0 으로 고정한다', () => {
    expect(
      selectSceneWarmupStep(
        input({ bvh: { pending: 1, done: 2.9, total: Number.NaN } }),
      ),
    ).toEqual({ kind: 'bvh', done: 2, total: 0 });
    expect(
      selectSceneWarmupStep(
        input({
          assetsActive: true,
          assetsLoaded: -3,
          assetsTotal: Number.POSITIVE_INFINITY,
        }),
      ),
    ).toEqual({ kind: 'assets', loaded: 0, total: 0 });
  });

  it('assets 는 loaded/total 이 0 이어도 active 면 보인다(로더 시작 직후)', () => {
    expect(selectSceneWarmupStep(input({ assetsActive: true }))).toEqual({
      kind: 'assets',
      loaded: 0,
      total: 0,
    });
  });
});
