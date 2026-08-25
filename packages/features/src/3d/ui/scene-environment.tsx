import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  CircleGeometry,
  EquirectangularReflectionMapping,
  Mesh,
  type Scene,
  type Texture,
  type Vector3,
} from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { SEA_LEVEL_Y, resolveEnvironmentFileUrl } from '@crane/domain/3d';
import { createSeaSurfaceMaterial } from './sea-surface-material';

/**
 * EXR 파노라마를 배경(scene.background)과 환경광(scene.environment)에 함께 걸고,
 * 그 아래에 바다 평면(SeaSurface)을 깐다.
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
 *
 * 하늘은 scene.background(무한 배경, 풀스크린 1패스)가 그리고, 바다는
 * SeaSurface가 그린다 — 배경과 같은 규칙(시선 방향으로 EXR 샘플링)으로
 * 색을 내고 파도 노멀로 방향만 흔드는 셰이더(sea-surface-material.ts)라
 * 사진 톤이 그대로고 원판 가장자리에 이음새가 없다. background의 하반구는
 * 원판 너머 수평선 바로 아래 얇은 띠에서만 보인다.
 *
 * 수면 아래에 잠긴 모델(floating)은 바다가 가리지 않는다 — 바다 평면은
 * 깊이를 쓰지 않아 지도의 수면 아래 지형(드라이독)을 보호하기 때문이다.
 * 대신 모델 쪽 셰이더 패치가 깊이에 따라 물 색으로 흐리게 섞는다
 * (domain lib/sea-submersion.ts).
 *
 * GroundedSkybox(EXR 하반구를 바닥 평면에 투영)는 시도했다가 뺐다. EXR의
 * 바다는 "바로 아래는 어둡고 수평선은 밝은" **시점 의존** 프레넬 그라데이션
 * 이라, 이를 월드 한 점에 고정 투영하면 어두운 점이 그 자리에 박히고 밝은
 * 수평선 행이 방사형으로 늘어진다(height/반경을 바꿔도 남는다). 게다가
 * 돔 밖으로 카메라가 나가면 구멍이 나 폴백 배경이 한 번 더 필요했다.
 * 프레임버퍼를 복사해 수면 아래를 블러하는 오버레이도 시도했다가 뺐다 —
 * alpha:false 프레임버퍼와 텍스처 포맷 호환에 취약해 선체가 검게 덮였다.
 */
const ENVIRONMENT_INTENSITY = 0.18;

/**
 * 바다 평면 파라미터.
 *
 * radius: 원판 반경. SCENE_CAMERA_CLIP.far(50000) 안에 둬 잘리는 경계가 far
 *   평면이 아니라 깔끔한 원 가장자리가 되게 한다. 가장자리 너머는
 *   scene.background의 EXR 바다가 이어 받는다 — 카메라 y=132에서 수평선
 *   아래 0.19°(1080p 기준 수 px)라 이음새가 거의 안 보인다. 보이면
 *   가장자리 알파 페이드를 붙일 것. 중심은 원점 — 반경이 씬보다 훨씬 커서
 *   어디에 두든 차이가 없다.
 * 높이는 SEA_LEVEL_Y(domain) — 지도 GLB 바다·떠 있는 모델의 드롭/잠김과 공유.
 * waveStrength: 파도 기울기 배율. 1이 사인파의 물리 기울기(최대 ~10°),
 *   0이면 배경과 픽셀 단위로 동일 — 방향 규약 검증용.
 * fadeStart/End: 카메라 거리 기준 파도 감쇠 구간. 원거리 앨리어싱을 막고
 *   원판 가장자리를 배경과 같은 색으로 수렴시킨다. 반짝임이 보이면 start를
 *   내린다.
 * waveSpeed: 시간 배율. 1이면 너울 주기 ~11초.
 */
const SEA_RADIUS = 40_000;
const SEA_WAVE_STRENGTH = 1;
const SEA_FADE_START = 3000;
const SEA_FADE_END = 10_000;
const SEA_WAVE_SPEED = 1;

/**
 * 카메라 y 하한. 바다 평면(y=0) 바로 위 — 아래로 내려가면 단면 컬링으로
 * 바다 뒷면이 투명해진다.
 *
 * EXR 씬(goliath, philly-2dock)은 카메라 타깃이 지면 아래(y=-343, -235)라
 * OrbitControls 기본값으로는 하늘 쪽 회전만으로 카메라가 y<0에 도달한다.
 * 회전은 maxPolarAngle을 매 프레임 "카메라 y가 하한에 닿는 각"으로 갱신해
 * 막고(궤도 반경·타깃 높이에 따라 달라지므로 상수로 둘 수 없다), 팬은
 * maxPolarAngle로 못 막으니 update 이후 카메라·타깃을 같이 밀어 올린다.
 */
const CAMERA_MIN_Y = 1;

interface OrbitControlsLike {
  target: Vector3;
  maxPolarAngle: number;
}

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

/**
 * 바다 평면 — 셰이더 원리는 sea-surface-material.ts 참고.
 *
 * renderOrder -1 + depthWrite:false(머티리얼) — 항상 먼저 그려지고 깊이를
 * 남기지 않아 지도(GLB 바다 y≈-0.017 포함)가 위에 덮인다. z-fighting 없음.
 * raycast는 noop — 에디터의 marquee 선택/드롭 배치 raycast에 40km 원판이
 * 잡히면 안 된다.
 *
 * geometry/material은 이 컴포넌트 소유라 unmount에 dispose한다. 텍스처는
 * useLoader 캐시 소유이므로 건드리지 않는다.
 */
function SeaSurface({ texture }: { texture: Texture }) {
  const sea = useMemo(() => {
    const geometry = new CircleGeometry(SEA_RADIUS, 96);
    const material = createSeaSurfaceMaterial(texture, {
      waveStrength: SEA_WAVE_STRENGTH,
      fadeStart: SEA_FADE_START,
      fadeEnd: SEA_FADE_END,
    });
    const mesh = new Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = SEA_LEVEL_Y;
    mesh.renderOrder = -1;
    mesh.raycast = () => {};
    return mesh;
  }, [texture]);

  useEffect(
    () => () => {
      sea.geometry.dispose();
      sea.material.dispose();
    },
    [sea],
  );

  // uTime은 useFrame에서 매 프레임 증가 — 훅 의존성으로 넘긴 sea를 직접
  // 변경하면 react-hooks/immutability에 걸리므로 uniform 객체만 ref로 든다.
  const timeUniformRef = useRef(sea.material.uniforms.uTime);
  useEffect(() => {
    timeUniformRef.current = sea.material.uniforms.uTime;
  }, [sea]);
  useFrame((_, delta) => {
    timeUniformRef.current.value += delta * SEA_WAVE_SPEED;
  });

  return <primitive object={sea} />;
}

/**
 * 카메라가 바다 평면 아래로 내려가지 못하게 잡는다(CAMERA_MIN_Y 주석 참고).
 *
 * 회전 클램프는 drei OrbitControls의 update(useFrame -1)보다 먼저(-2) 걸어
 * 같은 프레임의 update가 반영하게 하고, 팬 백스톱은 update 이후(0)에 건다.
 * 배경이 사라지면(unmount) 회전 제한도 함께 푼다 — 바다가 없으면 카메라를
 * 지면 아래로 내릴 이유를 막을 근거가 없다.
 */
function CameraAboveSea() {
  const get = useThree((s) => s.get);

  useEffect(
    () => () => {
      const controls = get().controls as OrbitControlsLike | null;
      if (controls) controls.maxPolarAngle = Math.PI;
    },
    [get],
  );

  // 회전 클램프: camera.y = target.y + dist·cos(φ) ≥ MIN_Y 가 되는 φ 상한.
  useFrame((state) => {
    const controls = state.controls as OrbitControlsLike | null;
    if (!controls) return;
    const dist = state.camera.position.distanceTo(controls.target);
    if (dist <= 0) return;
    const cos = (CAMERA_MIN_Y - controls.target.y) / dist;
    controls.maxPolarAngle =
      cos >= 1 ? 0 : cos <= -1 ? Math.PI : Math.acos(cos);
  }, -2);

  // 팬 백스톱: 카메라·타깃을 같은 양만큼 올려 궤도(offset)를 보존한다.
  useFrame((state) => {
    const controls = state.controls as OrbitControlsLike | null;
    const camera = state.camera;
    if (camera.position.y >= CAMERA_MIN_Y) return;
    const lift = CAMERA_MIN_Y - camera.position.y;
    camera.position.y += lift;
    if (controls) controls.target.y += lift;
  });

  return null;
}

/** 씬 배경 파노라마(EXR) + 바다 평면 + 카메라 하한. */
function EnvironmentBackground({ url }: { url: string }) {
  const texture = useLoader(EXRLoader, url);
  const scene = useThree((s) => s.scene);

  useEffect(
    () => applyEquirectBackground(scene, texture),
    [scene, texture],
  );

  return (
    <>
      <SeaSurface texture={texture} />
      <CameraAboveSea />
    </>
  );
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
 * 바다 평면도 인스턴스와 함께 unmount되므로 A→B 전환 시 두 장이 남지 않는다.
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
