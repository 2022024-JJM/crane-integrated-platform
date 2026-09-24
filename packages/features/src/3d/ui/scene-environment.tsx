import { Suspense, useEffect } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import {
  EquirectangularReflectionMapping,
  type Scene,
  type Texture,
} from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { resolveEnvironmentFileUrl, type SavedMapInfo } from '@crane/domain/3d';
import { SCENE_ENVIRONMENT_INTENSITY } from '../lib/sky-lighting';
import { SceneObjectBoundary } from './scene-object-boundary';
import { SceneWater } from './scene-water';

/**
 * 씬 배경 파노라마(EXR) + 바다(SceneWater) — 세 캔버스(모니터링·3D 플레이·
 * 에디터)가 같은 컴포넌트를 쓴다. 카메라 하한은 SceneCameraLimits 담당.
 *
 * EXR 은 배경(scene.background)과 환경광(scene.environment)에 함께 건다.
 * background 에만 걸면 하늘은 예쁜데 **크레인이 그 하늘을 전혀 반사하지
 * 않는다** — 강재 거더·도장면 같은 금속 PBR 머티리얼이 반사할 대상이 없어
 * 플라스틱처럼 납작해 보인다. 환경맵을 물리면 같은 텍스처가 반사광으로
 * 들어와 금속이 금속처럼 보인다.
 *
 * environmentIntensity 는 약하게 둔다(SCENE_ENVIRONMENT_INTENSITY). 목표는
 * "조명을 바꾸는 것" 이 아니라 **금속면에 반사를 얹는 것**이다 — 하늘 EXR
 * 전체가 광원이 되므로 체감 광량이 수치보다 크게 들어온다. 값을 올릴 일이
 * 생기면 조명(SCENE_LIGHTING)을 함께 내려 총 광량을 유지할 것. 낮/밤
 * (SceneLighting solar 모드)은 여기 값을 직접 건드리지 않고
 * `scene.backgroundIntensity` 와 `scene.environmentIntensity` 를 매 프레임
 * 하늘 밝기로 맞춘다 — 그래서 상수는 lib/sky-lighting 이 갖는다.
 *
 * 바다는 EXR 과 별개로 `seaVisible`(resolveSeaVisible — 씬의 `sea` 필드,
 * 미지정이면 배경이 있을 때)로 켠다. 미러 패스가 scene.background 를 그대로
 * 반사하므로 낮/밤 배경 밝기가 물에도 따라온다. 둘을 한 Suspense·한 return
 * 에 두는 이유: EXR 과 물이 같이 나타나고(물만 먼저 뜨면 몇 초간 검은 배경을
 * 반사), 배경 미지정→지정 전환에도 자식 인덱스가 유지돼 SceneWater(RT·
 * 머티리얼)가 리마운트되지 않는다.
 *
 * 텍스처는 useLoader 전역 캐시 소유이므로 unmount 에 dispose 하지 않는다
 * (재마운트 시 캐시된 텍스처를 다시 쓴다).
 *
 * 정리(cleanup)는 "이전 값 복원" 이 아니라 **자기가 건 텍스처일 때만 해제**
 * 한다. 배경 A→B 전환에서 두 컴포넌트가 잠시 공존하는데(Suspense 가 끼면
 * 순서가 더 뒤섞인다), 이전 값을 되돌리는 방식이면 A 의 cleanup 이 B 가 방금
 * 건 배경을 덮어써 하늘이 사라진다. 자기 것만 걷어내면 순서와 무관하게
 * 안전하다.
 *
 * 수면 아래에 잠긴 모델은 바다가 가리지 않는다 — 바다는 깊이를 쓰지 않아
 * 지도의 수면 아래 지형(드라이독)을 보호하기 때문이다. 대신 바다가 켜진 씬의
 * 모든 모델에 셰이더 패치를 걸어 깊이에 따라 물 색으로 흐리게 섞는다
 * (domain lib/sea-submersion.ts, GltfModel seaSubmersion).
 */
const ENVIRONMENT_INTENSITY = SCENE_ENVIRONMENT_INTENSITY;

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

/** 씬 배경 파노라마(EXR) — scene.background/environment 에 걸기만 한다. */
function EnvironmentBackground({ url }: { url: string }) {
  const texture = useLoader(EXRLoader, url);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);

  // scene.background/environment 는 리컨실러 밖 변조라 demand 캔버스에서
  // 프레임을 직접 깨운다(배경 교체·해제 직후 화면 반영).
  useEffect(() => {
    const cleanup = applyEquirectBackground(scene, texture);
    invalidate();
    return () => {
      cleanup();
      invalidate();
    };
  }, [scene, texture, invalidate]);

  return null;
}

/**
 * 배경은 씬의 `environmentId` 가 정하고, 지정이 없는 씬만 region 기본값으로
 * 떨어진다(resolveEnvironmentFileUrl 주석 참고). 바다는 호출자가
 * resolveSeaVisible 로 판정해 `seaVisible` 로 준다 — 여기서 environmentId 로
 * 바다를 유추하지 않는다.
 *
 * 4K EXR 은 수 MB~십수 MB — 자체 Suspense 로 씬(맵·모델) 로드를 붙잡지 않고
 * 준비되는 대로 나중에 나타난다. url 을 key 로 준다 — 인스턴스를 갈아끼워
 * 이전 텍스처의 effect 가 확실히 정리되게 한다. cleanup 이 자기 텍스처만
 * 걷어내므로(applyEquirectBackground) 전환 중 두 인스턴스가 겹쳐도 배경이
 * 깜빡이거나 사라지지 않는다.
 *
 * 배경과 물은 각각 SceneObjectBoundary(에러 격리만, Suspense 는 공유)로
 * 감싼다 — EXR 이나 노멀맵이 404 면 useLoader 가 던지고 Suspense 는 에러를
 * 잡지 않아 캔버스 전체가 비었다. 경계가 있으면 그 하나만 빠지고 원인은
 * 콘솔에 남는다. 두 슬롯의 위치는 고정이라 배경 미지정→지정 전환에도
 * 물이 리마운트되지 않는다.
 */
export function SceneEnvironment({
  regionId,
  environmentId,
  seaVisible,
  maps,
}: {
  regionId: string;
  environmentId?: string | null;
  seaVisible: boolean;
  /** 씬 지도 — 컨텍스트 지형을 바다 반사에서 뺄 때 쓴다. */
  maps?: SavedMapInfo[];
}) {
  const url = resolveEnvironmentFileUrl(regionId, environmentId);
  if (!url && !seaVisible) return null;
  return (
    <Suspense fallback={null}>
      {url ? (
        // key 는 경계에 — 배경이 바뀌면 에러 상태도 함께 초기화된다.
        <SceneObjectBoundary key={url} label={`environment ${url}`}>
          <EnvironmentBackground url={url} />
        </SceneObjectBoundary>
      ) : null}
      {seaVisible ? (
        <SceneObjectBoundary label="sea water">
          <SceneWater maps={maps} />
        </SceneObjectBoundary>
      ) : null}
    </Suspense>
  );
}
