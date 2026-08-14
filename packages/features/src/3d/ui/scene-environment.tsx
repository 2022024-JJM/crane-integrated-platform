import { useEffect } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import {
  EquirectangularReflectionMapping,
  type Scene,
  type Texture,
} from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { resolveEnvironmentFileUrl } from '@crane/domain/3d';

/**
 * scene.background에만 적용하고 scene.environment(IBL)는 건드리지 않는다 —
 * 씬 조명은 ambient/directional로 이미 튜닝되어 있어, 환경광까지 바꾸면
 * 모델 톤이 전부 달라진다. 배경은 "화면"만 바꾼다.
 *
 * 텍스처는 useLoader 전역 캐시 소유이므로 unmount에 dispose하지 않는다
 * (재마운트 시 캐시된 텍스처를 다시 쓴다).
 *
 * 정리(cleanup)는 "이전 값 복원"이 아니라 **자기가 건 텍스처일 때만 해제**
 * 한다. 배경 A→B 전환에서 두 컴포넌트가 잠시 공존하는데(Suspense가 끼면
 * 순서가 더 뒤섞인다), 이전 값을 되돌리는 방식이면 A의 cleanup이 B가 방금
 * 건 배경을 덮어써 하늘이 사라진다. 자기 것만 걷어내면 순서와 무관하게
 * 안전하다.
 */
function applyEquirectBackground(scene: Scene, texture: Texture) {
  texture.mapping = EquirectangularReflectionMapping;
  scene.background = texture;
  return () => {
    if (scene.background === texture) {
      scene.background = null;
    }
  };
}

/** 씬 배경 파노라마(EXR). */
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
 *
 * 배경은 씬의 `environmentId`가 정하고, 지정이 없는 씬만 region 기본값으로
 * 떨어진다(resolveEnvironmentFileUrl 주석 참고).
 *
 * url을 key로 준다 — 인스턴스를 갈아끼워 이전 텍스처의 effect가 확실히
 * 정리되게 한다. cleanup이 자기 텍스처만 걷어내므로(applyEquirectBackground)
 * 전환 중 두 인스턴스가 겹쳐도 배경이 깜빡이거나 사라지지 않는다.
 */
export function SceneEnvironment({
  regionId,
  environmentId,
}: {
  regionId: string;
  environmentId?: string | null;
}) {
  const url = resolveEnvironmentFileUrl(regionId, environmentId);
  if (!url) return null;
  return <EnvironmentBackground key={url} url={url} />;
}
