import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import {
  createGroundGridMaterial,
  GROUND_GRID_PLANE_SIZE,
  GROUND_GRID_RENDER_ORDER,
} from '../lib/ground-grid-material';

const noRaycast = () => null;

/**
 * 편집기 바닥 격자 — 월드 y=0 에 고정된 불투명 선 오버레이.
 *
 * 높이는 y=0 고정이다(사용자 결정). 지형이 원점 아래에 있는 씬(goliath
 * 약 -343m)에서는 지형 위 공중에 뜬 참조면으로 보이는데, 피벗 높이를 따라
 * 움직이는 격자보다 "고정된 기준"이 낫다는 판단이다.
 *
 * 메시는 평면이 바닥나지 않게 매 프레임 카메라 XZ 를 따라가지만, 선은
 * 셰이더가 월드 좌표로 그리므로 월드 정수 좌표에 고정된다(1m 스냅과 일치).
 * 셀·구간·주요선의 원거리 처리와 투명도는 ground-grid-material 주석 참고.
 *
 * depthTest 를 끄고 renderOrder 0.5 로 그려 씬 객체(0) 위, 선택 박스(1)·
 * 기즈모(Infinity) 아래에 놓인다 — 모델 안쪽이어도 선택 박스처럼 보인다.
 * raycast 를 끊어 마퀴·드롭·빈 곳 클릭(선택 해제)이 격자에 먹히지 않게
 * 한다(바다 평면 scene-environment 와 같은 규칙).
 */
export function EditorGroundGrid() {
  const meshRef = useRef<Mesh | null>(null);
  const material = useMemo(() => createGroundGridMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera }) => {
    meshRef.current?.position.set(camera.position.x, 0, camera.position.z);
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={GROUND_GRID_RENDER_ORDER}
      frustumCulled={false}
      raycast={noRaycast}
      material={material}
    >
      <planeGeometry args={[GROUND_GRID_PLANE_SIZE, GROUND_GRID_PLANE_SIZE]} />
    </mesh>
  );
}
