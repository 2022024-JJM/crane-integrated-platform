import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { TerrainLodController } from '../model/terrain-lod-controller';

/**
 * 기본 카메라의 LOD 구동 — 지형 타일·모델 LOD 노드의 가시성을 카메라 거리에
 * 따라 전환한다. 상태·발견·쓰기는 model/terrain-lod-controller.ts, 수식·임계는
 * lib/terrain-lod.ts(테스트 대상). 여기는 배선만.
 *
 * 분할 화면(scene-split-renderer)은 자기 컨트롤러로 타일 카메라마다 다시
 * 적용한다 — 가시성이 씬에 하나뿐이라 그리기 직전에 그 카메라 기준으로
 * 써야 한다. 이 컴포넌트는 priority 0 에서 기본 카메라 기준으로 쓰고, 분할
 * 렌더러가 priority 1 에서 타일마다 덮어쓴다.
 */
export function SceneTerrainLod() {
  const controller = useMemo(() => new TerrainLodController(), []);

  useFrame(({ camera, gl }) => {
    // domElement.height = 드로잉 버퍼 세로 device px(CSS px × DPR).
    controller.apply('main', camera, gl.domElement.height);
  });

  return null;
}
