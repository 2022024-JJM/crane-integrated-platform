import { useGLTF } from '@react-three/drei';
import { withBaseUrl } from './asset-url';

/**
 * GLTF 캐시 해제 — region을 떠날 때 그 씬이 쓰던 GLB만 골라 비운다.
 *
 * 왜 필요한가: drei의 `useGLTF`는 URL을 키로 전역 캐시에 파싱 결과를 들고
 * 있고, 해제 호출이 없으면 **영원히** 남는다. 지역을 순회할수록 CPU 메모리와
 * VRAM이 단조 증가해, 장시간 관제 세션에서 탭이 느려지다 죽는다. 시연에서
 * 여러 지역을 오가는 흐름이 정확히 이 경로다.
 *
 * 왜 컴포넌트 unmount 시점이 아닌가: `SkeletonUtils.clone`은 지오메트리와
 * 머티리얼을 **캐시 원본과 공유**한다(useClonedModel 참고). 인스턴스 하나가
 * 사라졌다고 dispose하면 같은 GLB를 쓰는 다른 인스턴스까지 깨진다. 그래서
 * "이 region의 모든 인스턴스가 사라진" 이 시점에만 안전하다.
 *
 * 한계(알고 쓸 것): r3f의 loader 캐시는 **읽기 API가 없다** — `useLoader`는
 * preload/clear만 노출하고 파싱 결과를 꺼낼 방법이 없다. 그래서 캐시 원본의
 * 지오메트리를 직접 dispose할 수는 없고, 캐시 참조를 끊어 GC 대상으로
 * 만드는 데까지가 이 함수의 역할이다. GPU 자원은 three가 참조를 잃은
 * 텍스처/버퍼를 정리할 때 함께 회수된다.
 *
 * BVH(boundsTree)도 마찬가지다. 지오메트리에 붙은 파생 데이터라 캐시 참조가
 * 끊기면 지오메트리와 함께 회수된다. 개별 인스턴스 unmount에서 끊지 않는
 * 이유는 지오메트리가 공유되기 때문이다 — 같은 GLB를 2개 배치한 씬(LLC-002)
 * 에서 하나가 사라졌다고 BVH를 지우면 남은 쪽 raycast가 느려진다.
 */

/**
 * GLB를 미리 캐시에 올린다.
 *
 * 씬 JSON은 필요한 GLB 목록을 이미 알고 있으므로, 컴포넌트가 마운트되기를
 * 기다리지 않고 곧바로 요청을 시작할 수 있다. 마운트를 기다리면 요청이
 * 하나씩 나가 직렬에 가까워지는데, 지역 진입당 14~35MB라 그 차이가 크다.
 *
 * `useGLTF.preload`는 이미 캐시에 있으면 아무것도 하지 않으므로 중복 호출이
 * 안전하다.
 */
export function preloadGltf(path: string) {
  try {
    useGLTF.preload(withBaseUrl(path));
  } catch {
    // 프리로드 실패는 치명적이지 않다 — 실제 마운트 시 다시 시도된다.
  }
}

/**
 * 주어진 모델 경로들의 GLTF 캐시를 비운다.
 *
 * @param paths 씬 JSON에 있는 경로(`/models/x.glb`). BASE_URL은 내부에서 붙인다.
 *
 * 실패해도 조용히 넘어간다 — 메모리 정리는 사용자 작업을 막을 이유가 없고,
 * 이미 해제된 항목을 다시 지우려는 경우가 정상적으로 발생한다.
 */
export function releaseGltfCache(paths: readonly string[]) {
  for (const path of paths) {
    try {
      useGLTF.clear(withBaseUrl(path));
    } catch {
      // 캐시에 없거나 이미 해제된 경우 — 무시한다.
    }
  }
}
