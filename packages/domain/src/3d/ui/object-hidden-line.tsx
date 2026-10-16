import { createPortal } from '@react-three/fiber';
import { useMemo } from 'react';
import { Mesh, type Object3D } from 'three';
import { createPlanHiddenLineMeshes } from '../lib/plan-hidden-line';
import { isPlanOverlayEligible } from '../lib/plan-overlay-budget';

function HiddenLineMesh({ mesh, index }: { mesh: Mesh; index: number }) {
  const passes = useMemo(
    () => createPlanHiddenLineMeshes(mesh, index),
    [mesh, index],
  );
  return createPortal(
    <>
      {passes.map((pass) => (
        <primitive key={pass.uuid} object={pass} />
      ))}
    </>,
    mesh,
  );
}

/**
 * 평면도 숨은선 — 노드 서브트리의 모든 Mesh 에 세 패스 오버레이를 포털로
 * 붙인다(원리·순서 계약은 lib/plan-hidden-line.ts). `index` 는 같은 캔버스의
 * 숨은선 대상 중 이 모델의 자리(0부터) — 모델끼리 패스가 섞이지 않게 한다.
 * LOD 사본은 실루엣과 같은 이유로, 큰 몸체 메쉬는 예산(plan-overlay-budget.ts)으로 뺀다. Canvas 안에서만 쓴다.
 */
export function ObjectHiddenLine({
  objects,
  index,
}: {
  objects: readonly Object3D[];
  index: number;
}) {
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
        <HiddenLineMesh key={mesh.uuid} mesh={mesh} index={index} />
      ))}
    </>
  );
}
