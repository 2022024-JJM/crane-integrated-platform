import { useEffect } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import {
  EquirectangularReflectionMapping,
  type Scene,
  type Texture,
} from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { getEnvironmentFileUrlByRegionId } from '@crane/domain/3d';

/**
 * scene.background에만 적용하고 scene.environment(IBL)는 건드리지 않는다 —
 * 씬 조명은 ambient/directional로 이미 튜닝되어 있어, 환경광까지 바꾸면
 * 모델 톤이 전부 달라진다. 배경은 "화면"만 바꾼다.
 *
 * 텍스처는 useLoader 전역 캐시 소유이므로 unmount에 dispose하지 않는다
 * (재마운트 시 캐시된 텍스처를 다시 쓴다). 배경만 이전 값으로 복원한다.
 */
function applyEquirectBackground(scene: Scene, texture: Texture) {
  texture.mapping = EquirectangularReflectionMapping;
  const previous = scene.background;
  scene.background = texture;
  return () => {
    scene.background = previous;
  };
}

/** region별 파노라마(EXR) 씬 배경. */
function EnvironmentBackground({ url }: { url: string }) {
  const texture = useLoader(EXRLoader, url);
  const scene = useThree((s) => s.scene);

  useEffect(
    () => applyEquirectBackground(scene, texture),
    [scene, texture],
  );

  return null;
}

/**
 * 4K EXR은 수 MB~십수 MB — 호출부에서 자체 Suspense로 감싸,
 * 씬(맵·모델) 로드를 붙잡지 않고 준비되는 대로 나중에 나타나게 한다.
 */
export function SceneEnvironment({ regionId }: { regionId: string }) {
  const url = getEnvironmentFileUrlByRegionId(regionId);
  if (!url) return null;
  return <EnvironmentBackground url={url} />;
}
