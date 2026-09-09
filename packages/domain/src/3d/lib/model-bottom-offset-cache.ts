import { Box3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { withBaseUrl } from '@crane/core/lib/asset-url';
import { extendGltfLoaderWithKtx2 } from './ktx2-loader';

/**
 * GLTF url 단위로 모델의 unscaled bottom offset을 캐시한다.
 *
 * GLTF 모델마다 origin 위치가 다르다 — 어떤 모델은 origin이 모델 중앙,
 * 어떤 건 바닥, 어떤 건 위쪽에 있다. 사용자가 카탈로그에서 모델을 드래그-드롭
 * 할 때 "바닥이 지면(y=0)에 딱 닿도록" 자동 배치하려면 모델별로 origin 기준
 * 바닥까지의 거리를 알아야 한다.
 *
 * 캐시 값 = `-box.min.y` (unscaled, GLTF 원본 단위).
 * 사용 시점에 사용자의 scale.y를 곱해 실제 world offset을 얻는다:
 *   `worldYOffset = unscaledOffset * model.scale[1]`
 *
 * unscaled로 저장하는 이유:
 *   - 같은 url의 모델이 여러 instance로 다른 scale을 가질 수 있다.
 *   - prefetch 시 root.scale을 mutate하면 drei가 들고 있는 GLTF 원본 객체와
 *     충돌할 위험이 있다(별도 GLTFLoader이긴 하나 안전 우선).
 */
const cache = new Map<string, number>();
const inflight = new Map<string, Promise<number>>();

// GLB들이 EXT_meshopt_compression으로 압축되어 있어 디코더가 필수다.
// drei useGLTF는 기본으로 meshopt 디코더를 붙이지만, 이 로더는 별도 인스턴스라 직접 배선한다.
const sharedLoader = new GLTFLoader();
sharedLoader.setMeshoptDecoder(MeshoptDecoder);
// KTX2(KHR_texture_basisu)도 마찬가지 — 배선이 빠지면 KTX2 GLB 파스가 throw
// 된다. 단 모듈 로드 시점이 아니라 첫 로드 때 건다: ktx2-loader 의 지원 검사가
// WebGL 컨텍스트를 잠깐 만드는데, 이 모듈은 jsdom 테스트와 로그인 번들에서도
// import 되기 때문이다(멱등 — 로더 싱글턴은 1회만 만들어진다).
let ktx2Wired = false;
function ensureKtx2Wired(): void {
  if (ktx2Wired) return;
  ktx2Wired = true;
  extendGltfLoaderWithKtx2(sharedLoader);
}

function measureBottomOffset(root: Object3D): number {
  // Box3.setFromObject는 내부에서 updateWorldMatrix(true, false)를 호출한 후
  // descendants의 geometry bbox를 합친다. root에 별도 transform 적용 없이
  // 그대로 측정하면 GLTF의 "원본 단위" bbox가 나온다.
  // root의 자체 transform이 측정에 섞이지 않도록 일시적으로 항등으로 만든다.
  const prevPos = root.position.clone();
  const prevRot = root.rotation.clone();
  const prevScale = root.scale.clone();
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);

  const box = new Box3().setFromObject(root);

  root.position.copy(prevPos);
  root.rotation.copy(prevRot);
  root.scale.copy(prevScale);
  root.updateMatrixWorld(true);

  if (box.isEmpty()) {
    return 0;
  }
  return -box.min.y;
}

/**
 * 모델 GLTF를 fetch해 unscaled bottom offset을 캐시한다. 같은 url에 대해
 * 여러 번 호출되어도 fetch는 최대 1회.
 */
export function prefetchModelBottomOffset(url: string): Promise<number> {
  const cached = cache.get(url);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  const existing = inflight.get(url);
  if (existing) {
    return existing;
  }

  ensureKtx2Wired();
  const promise = sharedLoader
    .loadAsync(withBaseUrl(url))
    .then((gltf) => {
      const offset = measureBottomOffset(gltf.scene);
      cache.set(url, offset);
      return offset;
    })
    .catch((error) => {
      console.error('Failed to compute bottom offset for', url, error);
      cache.set(url, 0);
      return 0;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, promise);
  return promise;
}

/**
 * 이미 mount된 cloned model로 캐시를 채운다. useClonedModel의 useMemo 안에서
 * 호출하는 fast path. 비동기 fetch를 거치지 않으므로 정확도가 보장된다.
 * 캐시에 이미 있으면 no-op.
 */
export function fillModelBottomOffsetFromClone(
  url: string,
  cloneRoot: Object3D,
): void {
  if (cache.has(url)) return;
  cache.set(url, measureBottomOffset(cloneRoot));
}

/** 캐시에 이미 있는 unscaled offset을 동기로 가져온다. 없으면 null. */
export function getModelBottomOffset(url: string): number | null {
  const cached = cache.get(url);
  return cached !== undefined ? cached : null;
}
