import { createPortal, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Mesh,
  PerspectiveCamera,
  type Object3D,
  type ShaderMaterial,
} from 'three';
import {
  SILHOUETTE_OUTLINE_PX,
  createSilhouetteMaskMesh,
  createSilhouetteOutlineHull,
  createSilhouetteOutlineMaterial,
  outlineOffsetFactor,
} from '../lib/silhouette-outline';

/**
 * 메시 하나의 마스크 + 헐 — 생성·수치 계산은 lib/silhouette-outline.ts.
 *
 * 포털 컨테이너(mesh)는 이 컴포넌트 인스턴스의 수명 동안 바뀌지 않는다 —
 * 부모가 mesh.uuid 를 key 로 인스턴스를 새로 만들기 때문. R3F Portal 의
 * 컨테이너 교체 문제(model-selection-box.tsx 주석)를 그 key 가 막는다.
 *
 * dispose 대상 없음 — 마스크 geometry·머티리얼은 공유본, 헐 geometry 는
 * 캐시 소유, 헐 material 은 부모(ObjectSilhouetteOutline)가 정리한다.
 */
function SilhouetteMeshOutline({
  mesh,
  material,
}: {
  mesh: Mesh;
  material: ShaderMaterial;
}) {
  const overlays = useMemo(
    () => [createSilhouetteMaskMesh(mesh), createSilhouetteOutlineHull(mesh, material)],
    [mesh, material],
  );
  return createPortal(
    <>
      {overlays.map((overlay) => (
        <primitive key={overlay.uuid} object={overlay} />
      ))}
    </>,
    mesh,
  );
}

function SilhouetteNodeOutline({
  node,
  material,
}: {
  node: Object3D;
  material: ShaderMaterial;
}) {
  const meshes = useMemo(() => {
    const out: Mesh[] = [];
    node.traverse((child) => {
      if (child instanceof Mesh) out.push(child);
    });
    return out;
  }, [node]);

  return (
    <>
      {meshes.map((mesh) => (
        <SilhouetteMeshOutline key={mesh.uuid} mesh={mesh} material={material} />
      ))}
    </>
  );
}

interface ObjectSilhouetteOutlineProps {
  /**
   * 테두리를 두를 노드들. 여럿이면 화면 발자국 합집합 하나로 읽힌다 —
   * 충돌 하이라이트는 부딪힌 두 모델을 함께 넘긴다. 노드가 리마운트되면
   * (clone 교체 등) 새 참조를 넘겨야 한다 — 메시 수집이 참조 기준이다.
   */
  objects: readonly Object3D[];
  /** 테두리 색 (선택 SELECTION_LINE_COLOR / 충돌 COLLISION_LINE_COLOR 등). */
  color: string;
}

/**
 * 일체형 실루엣 테두리 — 노드 서브트리의 모든 Mesh 에 스텐실 마스크와
 * 인플레이션 헐을 포털로 붙인다(원리·캔버스 전제는 lib/silhouette-outline.ts
 * 상단 주석). 메시 자식으로 마운트되므로 리그 드라이버·기즈모가 움직여도
 * 씬 그래프 상속으로 따라간다(선택 박스와 같은 원리). Canvas 안에서만 쓴다.
 *
 * 같은 캔버스에 인스턴스가 여러 개면(예: 다중 선택, 선택+충돌 동시) 모든
 * 마스크가 모든 헐보다 먼저 그려져 발자국이 전역 합집합이 된다 — 겹친
 * 대상들 사이 경계선도 지워지는데, "붙어 보이는 것은 한 덩어리로 두른다"는
 * 일체형 표시 의도와 일치해 그대로 둔다.
 */
export function ObjectSilhouetteOutline({
  objects,
  color,
}: ObjectSilhouetteOutlineProps) {
  // 헐 공유 머티리얼 — 이 표시 단위의 모든 헐 메시가 하나를 쓴다. 색이
  // 바뀌면 새로 만든다(실제로는 용도별 상수라 수명 내 불변).
  const material = useMemo(() => createSilhouetteOutlineMaterial(color), [color]);
  useEffect(() => () => material.dispose(), [material]);

  // 화면 두께(px) → 오프셋 계수. 훅 의존성인 material 을 effect 에서 직접
  // 변경하면 react-hooks/immutability 에 걸리므로 uniform 객체만 ref 로
  // 든다(scene-environment 의 SeaSurface uTime 과 같은 선례). material 이
  // 바뀌면(색 변경) 첫 effect 가 ref 를 갈아 끼운다.
  const heightPx = useThree((s) => s.size.height);
  const camera = useThree((s) => s.camera);
  const fov = camera instanceof PerspectiveCamera ? camera.fov : 60;
  const offsetUniformRef = useRef(material.uniforms.uOffsetFactor);
  useEffect(() => {
    offsetUniformRef.current = material.uniforms.uOffsetFactor;
  }, [material]);
  useEffect(() => {
    offsetUniformRef.current.value = outlineOffsetFactor(
      SILHOUETTE_OUTLINE_PX,
      fov,
      heightPx,
    );
  }, [material, fov, heightPx]);

  return (
    <>
      {objects.map((node) => (
        <SilhouetteNodeOutline key={node.uuid} node={node} material={material} />
      ))}
    </>
  );
}
