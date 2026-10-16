import { createPortal, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Mesh, type Object3D } from 'three';
import { resolveCameraFov } from '@crane/core/lib/top-view-pose';
import {
  PLAN_FILL_PX,
  createPlanFillMaterial,
  createPlanFillMesh,
  publishPlanFillOffset,
} from '../lib/plan-fill';
import { isPlanOverlayEligible } from '../lib/plan-overlay-budget';
import { outlineOffsetFactor } from '../lib/silhouette-outline';
import { useSceneViewportHeight } from '../model/scene-viewports-context';

function PlanFillMesh({ mesh }: { mesh: Mesh }) {
  // 메쉬의 현재 머티리얼(공유 variant·알람 tint 등)에서 만든다 — 머티리얼
  // 참조가 바뀌면(잠김 variant 교체) 다시 만든다.
  const source = mesh.material;
  const material = useMemo(
    () => createPlanFillMaterial(Array.isArray(source) ? source[0] : source),
    [source],
  );
  useEffect(() => () => material.dispose(), [material]);
  const fill = useMemo(
    () => createPlanFillMesh(mesh, material),
    [mesh, material],
  );
  return createPortal(<primitive object={fill} />, mesh);
}

/**
 * 평면도 채움 — 노드 서브트리의 모든 Mesh 에 자기 색 부풀림 헐을 포털로
 * 붙인다(원리는 lib/plan-fill.ts). 실루엣 윤곽(ObjectSilhouetteOutline)의
 * 마스크가 같은 스텐실 비트를 찍어 두므로 **윤곽과 함께** 써야 한다 — 마스크
 * 없이 혼자 쓰면 발자국 안까지 덮어 모델이 부풀어 보인다. 두께 계수는
 * 뷰포트 높이·카메라 fov 로 구해 전역 유니폼에 쓴다(캔버스 하나 기준). 큰 몸체
 * 메쉬는 예산(plan-overlay-budget.ts)으로 뺀다 — 넓어서 채울 필요가 없다.
 */
export function ObjectPlanFill({ objects }: { objects: readonly Object3D[] }) {
  const heightPx = useSceneViewportHeight();
  const camera = useThree((s) => s.camera);
  const fov = resolveCameraFov(camera) ?? 60;
  useEffect(() => {
    publishPlanFillOffset(outlineOffsetFactor(PLAN_FILL_PX, fov, heightPx));
  }, [fov, heightPx]);

  const meshes = useMemo(() => {
    const out: Mesh[] = [];
    for (const node of objects) {
      node.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        if ((child.userData as { terrainLodProxy?: boolean }).terrainLodProxy) {
          return;
        }
        if (!isPlanOverlayEligible(child)) return;
        out.push(child);
      });
    }
    return out;
  }, [objects]);

  return (
    <>
      {meshes.map((mesh) => (
        <PlanFillMesh key={mesh.uuid} mesh={mesh} />
      ))}
    </>
  );
}
