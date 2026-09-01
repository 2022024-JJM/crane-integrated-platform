import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import {
  fillModelBottomOffsetFromClone,
  getModelBottomOffset,
  prefetchModelBottomOffset,
} from '../model-bottom-offset-cache';

// GLTF fetch를 실제로 하지 않도록 로더를 통제한다. 캐시는 모듈 싱글턴이라
// 테스트 간 초기화가 불가능하므로, 케이스마다 서로 다른 url을 쓴다.
const { loadAsyncMock } = vi.hoisted(() => ({
  loadAsyncMock: vi.fn<(url: string) => Promise<{ scene: unknown }>>(),
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setMeshoptDecoder() {}
    loadAsync = loadAsyncMock;
  },
}));

/** 바닥이 y = -bottom 에 오는 2×4×2 박스 모델 */
function modelWithBottom(bottom: number): Group {
  const group = new Group();
  const mesh = new Mesh(new BoxGeometry(2, 4, 2), new MeshBasicMaterial());
  mesh.position.y = 2 - bottom; // box min.y = mesh.y - 2 = -bottom
  group.add(mesh);
  return group;
}

afterEach(() => {
  loadAsyncMock.mockReset();
});

describe('fillModelBottomOffsetFromClone / getModelBottomOffset', () => {
  it('clone의 bbox 바닥으로 캐시를 채운다 (-box.min.y)', () => {
    fillModelBottomOffsetFromClone('/models/fill-a.glb', modelWithBottom(2));
    expect(getModelBottomOffset('/models/fill-a.glb')).toBeCloseTo(2, 5);
  });

  it('root의 자체 transform은 측정에서 제외되고(unscaled), 측정 후 복원된다', () => {
    const root = modelWithBottom(2);
    root.scale.set(5, 5, 5);
    root.position.set(10, 10, 10);
    fillModelBottomOffsetFromClone('/models/fill-b.glb', root);

    expect(getModelBottomOffset('/models/fill-b.glb')).toBeCloseTo(2, 5);
    expect(root.scale.y).toBe(5);
    expect(root.position.y).toBe(10);
  });

  it('이미 캐시된 url이면 no-op (첫 측정이 이긴다)', () => {
    fillModelBottomOffsetFromClone('/models/fill-c.glb', modelWithBottom(1));
    fillModelBottomOffsetFromClone('/models/fill-c.glb', modelWithBottom(9));
    expect(getModelBottomOffset('/models/fill-c.glb')).toBeCloseTo(1, 5);
  });

  it('빈 모델은 0', () => {
    fillModelBottomOffsetFromClone('/models/fill-empty.glb', new Group());
    expect(getModelBottomOffset('/models/fill-empty.glb')).toBe(0);
  });

  it('캐시에 없는 url은 null', () => {
    expect(getModelBottomOffset('/models/never-seen.glb')).toBeNull();
  });
});

describe('prefetchModelBottomOffset', () => {
  it('GLTF를 로드해 offset을 캐시한다', async () => {
    loadAsyncMock.mockResolvedValue({ scene: modelWithBottom(3) });
    await expect(
      prefetchModelBottomOffset('/models/prefetch-a.glb'),
    ).resolves.toBeCloseTo(3, 5);
    expect(getModelBottomOffset('/models/prefetch-a.glb')).toBeCloseTo(3, 5);
  });

  it('동시 호출은 in-flight promise를 공유해 fetch가 1회다', async () => {
    let resolveLoad: (value: { scene: Group }) => void = () => {};
    loadAsyncMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const first = prefetchModelBottomOffset('/models/prefetch-b.glb');
    const second = prefetchModelBottomOffset('/models/prefetch-b.glb');
    expect(loadAsyncMock).toHaveBeenCalledTimes(1);

    resolveLoad({ scene: modelWithBottom(4) });
    await expect(first).resolves.toBeCloseTo(4, 5);
    await expect(second).resolves.toBeCloseTo(4, 5);
  });

  it('캐시 히트면 fetch 없이 즉시 resolve', async () => {
    fillModelBottomOffsetFromClone('/models/prefetch-c.glb', modelWithBottom(7));
    await expect(
      prefetchModelBottomOffset('/models/prefetch-c.glb'),
    ).resolves.toBeCloseTo(7, 5);
    expect(loadAsyncMock).not.toHaveBeenCalled();
  });

  it('로드 실패는 0으로 캐시한다 (재시도 없음)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    loadAsyncMock.mockRejectedValue(new Error('404'));

    await expect(
      prefetchModelBottomOffset('/models/prefetch-fail.glb'),
    ).resolves.toBe(0);
    expect(getModelBottomOffset('/models/prefetch-fail.glb')).toBe(0);

    // 실패도 캐시되어 다시 fetch하지 않는다.
    await prefetchModelBottomOffset('/models/prefetch-fail.glb');
    expect(loadAsyncMock).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
