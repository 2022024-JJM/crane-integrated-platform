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
 * EXR 파노라마를 배경(scene.background)과 환경광(scene.environment)에 함께 건다.
 *
 * 예전에는 background에만 걸었다. 그러면 하늘은 예쁜데 **크레인이 그 하늘을
 * 전혀 반사하지 않는다** — 강재 거더·도장면 같은 금속 PBR 머티리얼이 반사할
 * 대상이 없어 플라스틱처럼 납작해 보인다. 환경맵을 물리면 같은 텍스처가
 * 반사광으로 들어와 금속이 금속처럼 보인다.
 *
 * environmentIntensity는 0.18로 약하게 둔다. 목표는 "조명을 바꾸는 것"이
 * 아니라 **금속면에 반사를 얹는 것**이다. 처음 0.35로 넣었을 때는 반사가
 * 조명처럼 작동해 화면이 과하게 밝아졌다 — 하늘 EXR 전체가 광원이 되므로
 * 체감 광량이 수치보다 크게 들어온다. 값을 올릴 일이 생기면 조명
 * (SCENE_LIGHTING)을 함께 내려 총 광량을 유지할 것.
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
const ENVIRONMENT_INTENSITY = 0.18;

function applyEquirectBackground(scene: Scene, texture: Texture) {
  texture.mapping = EquirectangularReflectionMapping;
  const previousIntensity = scene.environmentIntensity;
  scene.background = texture;
  scene.environment = texture;
  scene.environmentIntensity = ENVIRONMENT_INTENSITY;
  return () => {
    if (scene.background === texture) {
      scene.background = null;
    }
    if (scene.environment === texture) {
      scene.environment = null;
      scene.environmentIntensity = previousIntensity;
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
