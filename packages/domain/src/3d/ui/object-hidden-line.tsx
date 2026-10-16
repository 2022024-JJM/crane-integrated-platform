import { createPortal } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Mesh, type Object3D, type ShaderMaterial } from 'three';
import {
  PLAN_HIDDEN_OUTLINE_PX,
  createPlanHiddenFillQuad,
  createPlanHiddenLineMeshes,
  createPlanHiddenOutlineMaterial,
} from '../lib/plan-hidden-line';
import { useOutlineOffset } from '../model/use-outline-offset';

/**
 * 메쉬 하나의 패스 넷(표식 둘·윤곽·지우기). 포털 컨테이너(mesh)는 인스턴스
 * 수명 동안 바뀌지 않는다 — 부모가 mesh.uuid 를 key 로 새로 만든다.
 */
function HiddenLineMesh({
  mesh,
  index,
  outlineMaterial,
}: {
  mesh: Mesh;
  index: number;
  outlineMaterial: ShaderMaterial;
}) {
  const passes = useMemo(
    () => createPlanHiddenLineMeshes(mesh, index, outlineMaterial),
    [mesh, index, outlineMaterial],
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

/** 모델당 하나인 채움 쿼드 — 컨테이너는 부모가 uuid 를 key 로 고정한다. */
function HiddenFillQuad({
  container,
  index,
}: {
  container: Object3D;
  index: number;
}) {
  const quad = useMemo(() => createPlanHiddenFillQuad(index), [index]);
  return createPortal(<primitive object={quad} />, container);
}

/**
 * 평면도 숨은선 — 노드 서브트리의 **모든** Mesh 에 메쉬 패스를, 첫 노드에
 * 채움 쿼드를 포털로 붙인다(원리·순서 계약은 lib/plan-hidden-line.ts).
 * `index` 는 같은 캔버스의 숨은선 대상 중 이 모델의 자리(0부터) — 모델끼리
 * 패스가 섞이지 않게 한다.
 *
 * 메쉬를 거르지 않는다. 표식이 없는 메쉬는 그 아래 자기 부재를 "정체불명의
 * 가림" 으로 만들어 고스트가 되므로 큰 몸체도 LOD 사본도 전부 붙인다 — 사본은
 * 보이는 거리에서만 그려지고(가시성 상속) 그때 사본이 표식을 찍는다.
 * Canvas 안에서만 쓴다.
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
        if (child instanceof Mesh) out.push(child);
      });
    }
    return out;
  }, [objects]);

  // 윤곽 헐 머티리얼 — 이 모델의 모든 헐이 공유. 두께 유니폼이 캔버스 기준이라
  // 표시 단위마다 만든다.
  const outlineMaterial = useMemo(() => createPlanHiddenOutlineMaterial(), []);
  useEffect(() => () => outlineMaterial.dispose(), [outlineMaterial]);
  useOutlineOffset(outlineMaterial, PLAN_HIDDEN_OUTLINE_PX);

  const container = objects[0];
  return (
    <>
      {meshes.map((mesh) => (
        <HiddenLineMesh
          key={mesh.uuid}
          mesh={mesh}
          index={index}
          outlineMaterial={outlineMaterial}
        />
      ))}
      {container ? (
        <HiddenFillQuad
          key={container.uuid}
          container={container}
          index={index}
        />
      ) : null}
    </>
  );
}
