import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { Mesh, type Object3D } from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import { withBaseUrl } from '@crane/core/lib/asset-url';
import {
  getHologramMaterial,
  HOLOGRAM_RENDER_ORDER,
} from '../lib/hologram-material';
import { extendGltfLoaderWithKtx2 } from '../lib/ktx2-loader';
import { findMeshByPath } from '../lib/mesh-path';
import { markOverlayMesh } from '../lib/overlay-mesh';
import type { GhostNodePose } from '../lib/ghost-pose';

/**
 * 미래 자세 고스트 — 같은 GLB 를 한 벌 더 그리되 홀로그램 머티리얼로 덮어
 * "몇 초 뒤 이 장비가 여기 있다" 를 형태 그대로 보여 준다.
 *
 * 실물 트리를 재사용하지 않고 새로 clone 하는 이유는 실물이 지금 자세로
 * 보여야 하기 때문이다(예측은 미래를 겹쳐 보여 주는 것이지 실물을 옮기는 게
 * 아니다). 자세는 `nodes` 로 받은 **로컬 transform 스냅샷**을 경로로 찾아
 * 덮어쓴다 — 리그 드라이버를 다시 돌리지 않으므로 rest pose 캐시·구속조건과
 * 얽히지 않는다.
 *
 * clone 은 지오메트리·텍스처를 GLTF 캐시와 공유하므로 추가 VRAM 이 없고,
 * 비용은 노드 트리 복사 한 번뿐이다. 예측 쌍이 바뀔 때만 다시 만들어진다.
 *
 * 씬을 오염시키지 않도록 셋을 끈다.
 * - 오버레이 표식: 충돌 감지가 이 메시를 실제 장비로 수집하면 자기 자신과
 *   부딪힌 것으로 보고한다(overlay-mesh 주석).
 * - 그림자: 고스트는 빛을 막지 않는다.
 * - raycast: 클릭·호버가 고스트에 걸리면 실물을 못 고른다.
 *
 * `modelObjectRegistry` 에 등록하지 않는다 — 같은 id 재등록은 실물 참조를
 * 밀어내 리그 드라이버가 고스트를 구동하게 된다.
 *
 * **전제: 실물 모델이 씬 루트 직계이고 고스트도 같은 층에 마운트된다.**
 * 스냅샷은 루트의 **로컬** transform 이므로, 실물이 변환된 group 안에 있고
 * 고스트가 그 밖에 있으면 그 group 만큼 어긋난다. 지금은 모니터링·에디터
 * 모두 `<primitive object={clone} position rotation scale>` 을 Fragment 로
 * 늘어놓아 성립한다(outdoor-work-model-simulation, scene-objects-edit-canvas).
 * 모델을 group 으로 감싸게 되면 고스트도 같은 group 안에 넣어야 한다.
 */

export function GhostModel({
  url,
  nodes,
  color,
  opacity,
}: {
  url: string;
  nodes: readonly GhostNodePose[];
  color: string;
  opacity: number;
}) {
  // KTX2 디코드 배선 — KTX2 GLB 를 여는 모든 경로가 같아야 한다(누락 시 throw).
  const { scene } = useGLTF(
    withBaseUrl(url),
    true,
    true,
    extendGltfLoaderWithKtx2,
  );
  const material = getHologramMaterial(color, opacity);

  const clone = useMemo(() => {
    const next = SkeletonUtils.clone(scene);
    next.traverse((child: Object3D) => {
      child.castShadow = false;
      child.receiveShadow = false;
      child.raycast = () => {};
      if (child instanceof Mesh) {
        markOverlayMesh(child);
        child.material = material;
        // 투명 객체 정렬이 카메라 각도에 따라 뒤바뀌며 블렌딩 결과가 튀는
        // 것을 막는다(hologram-material 주석).
        child.renderOrder = HOLOGRAM_RENDER_ORDER;
      }
    });
    return next;
  }, [scene, material]);

  // 자세 적용은 렌더 중이 아니라 effect 에서 — clone 은 씬 그래프에 이미
  // 붙어 있고, 스냅샷만 바뀌는 재렌더(잔상 opacity 변화 등)에서도 다시 맞춘다.
  useEffect(() => {
    for (const pose of nodes) {
      const node = findMeshByPath(clone, pose.nodePath);
      if (!node) continue;
      node.position.set(...pose.position);
      node.quaternion.set(
        pose.quaternion[0],
        pose.quaternion[1],
        pose.quaternion[2],
        pose.quaternion[3],
      );
      node.scale.set(...pose.scale);
    }
    clone.updateMatrixWorld(true);
  }, [clone, nodes]);

  return <primitive object={clone} />;
}
