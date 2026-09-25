import { Color, Vector3, type Object3D, type Scene } from 'three';
import { SCENE_KEY_LIGHT_NAME } from '../model/scene-lighting-info';
import type { OceanWater } from './ocean-water';
import {
  SCENE_ENVIRONMENT_INTENSITY,
  SCENE_LIGHTING_BASE,
} from './sky-lighting';

/**
 * 미니맵 캡처용 기준 조명 — 캡처 순간만 씬 조명을 SceneLighting 의 **수동
 * 모드 값**(백색 태양 `SCENE_LIGHTING_BASE.sunIntensity`, 백색 환경광
 * `SCENE_LIGHTING_BASE.ambientIntensity`, 환경맵 `SCENE_ENVIRONMENT_INTENSITY`,
 * 밤 전용 조명 0)으로 바꿔 찍고 렌더 뒤 원복한다(적용은
 * ui/scene-minimap-capture.tsx). 3D 화면의 기본(수동) 룩과 같은 색이 나오고,
 * solar 모드의 시각·작업등·그림자와 무관해 같은 씬은 언제 찍어도 같다.
 *
 * 전부 **유니폼만** 바꾼다 — 조명의 visible 이나 castShadow 를 건드리면
 * 조명 개수·shadow define 이 달라져 씬 머티리얼 전부가 재컴파일된다.
 * 그림자는 `shadow.intensity` 0(three 가 `mix(1, shadow, shadowIntensity)` 로
 * 섞는 유니폼)으로 뺀다.
 *
 * 키 방향광은 `SCENE_KEY_LIGHT_NAME` 으로 찾아 세기·색과 함께 **위치**를
 * 기준 태양 방향으로 옮긴다(three 방향광은 position−target 이 방향). 그동안
 * renderer 의 `shadowMap.autoUpdate`·`needsUpdate` 를 둘 다 끈다 — 같은
 * 프레임에서 먼저 돈 SceneLighting 의 `invalidateShadows()` 가 남긴
 * needsUpdate 를 캡처 렌더가 옮긴 조명으로 소비하면 메인 화면의 그림자가
 * 안전망 주기까지 엉뚱한 방향으로 남는다. 원복하면 보류된 needsUpdate 가
 * 메인 렌더에서 원래 조명으로 처리된다.
 *
 * 원복은 필수다 — SceneLighting 이 매 프레임 다시 쓰는 것은 키 조명의 위치
 * (solar 모드에선 세기·색도)뿐이고, `shadow.intensity`·환경광·환경맵 세기는
 * 한 번 두면 그대로라 빠뜨리면 그림자가 영영 꺼진다. 또 캡처가 useFrame
 * 안(메인 렌더 직전)이라 그 프레임이 기준 조명으로 화면에 그려지지 않으려면
 * 렌더 직후 되돌려야 한다.
 */

/**
 * 기준 태양 방향으로 옮긴 키 조명의 target 으로부터의 거리(m). 방향광은
 * 방향만 쓰고 그림자 패스는 캡처 동안 돌지 않으므로 값 자체는 결과에
 * 영향이 없다 — 0 이 아니기만 하면 된다.
 */
export const CANONICAL_KEY_LIGHT_DISTANCE = 300;

const CANONICAL_WHITE = new Color(1, 1, 1);

interface LightLike extends Object3D {
  isLight?: boolean;
  isAmbientLight?: boolean;
  isDirectionalLight?: boolean;
  intensity: number;
  color?: Color;
  shadow?: { intensity: number };
  target?: Object3D;
}

interface SavedLight {
  light: LightLike;
  intensity: number;
  color: Color | null;
  position: Vector3 | null;
  shadowIntensity: number | null;
}

interface ShadowMapOwner {
  shadowMap: { autoUpdate: boolean; needsUpdate: boolean };
}

/**
 * 씬 조명을 기준(수동 모드) 값으로 바꾸고 원복 함수를 돌려준다. 원복은
 * 저장해 둔 값을 그대로 되돌리며 두 번 불러도 한 번만 적용된다. apply 뒤에
 * 추가된 조명은 모른다(캡처는 한 프레임 안에서 끝난다). 키 조명이 없어도
 * 나머지는 적용된다. `sunDirection` 은 읽기만 한다(씬 → 태양 단위 벡터).
 *
 * 키 조명의 position 은 부모 로컬 좌표다 — SceneLighting 이 씬 루트에 두므로
 * target 월드 위치 + 방향으로 그대로 쓴다.
 */
export function applyCanonicalCaptureLighting(
  scene: Scene,
  renderer: ShadowMapOwner,
  sunDirection: Vector3,
): () => void {
  const saved: SavedLight[] = [];
  const targetWorld = new Vector3();
  scene.traverse((object) => {
    const light = object as LightLike;
    if (light.isLight !== true) return;
    const isKey =
      light.name === SCENE_KEY_LIGHT_NAME &&
      light.isDirectionalLight === true &&
      light.target !== undefined;
    saved.push({
      light,
      intensity: light.intensity,
      color: light.color ? light.color.clone() : null,
      position: isKey ? light.position.clone() : null,
      shadowIntensity: light.shadow ? light.shadow.intensity : null,
    });
    if (isKey) {
      light.intensity = SCENE_LIGHTING_BASE.sunIntensity;
      light.color?.copy(CANONICAL_WHITE);
      light.target!.getWorldPosition(targetWorld);
      light.position
        .copy(targetWorld)
        .addScaledVector(sunDirection, CANONICAL_KEY_LIGHT_DISTANCE);
    } else if (light.isAmbientLight === true) {
      light.intensity = SCENE_LIGHTING_BASE.ambientIntensity;
      light.color?.copy(CANONICAL_WHITE);
    } else {
      light.intensity = 0;
    }
    if (light.shadow) light.shadow.intensity = 0;
  });
  const environmentIntensity = scene.environmentIntensity;
  scene.environmentIntensity = scene.environment
    ? SCENE_ENVIRONMENT_INTENSITY
    : 0;
  const { shadowMap } = renderer;
  const shadowAutoUpdate = shadowMap.autoUpdate;
  const shadowNeedsUpdate = shadowMap.needsUpdate;
  shadowMap.autoUpdate = false;
  shadowMap.needsUpdate = false;

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const entry of saved) {
      entry.light.intensity = entry.intensity;
      if (entry.color && entry.light.color) entry.light.color.copy(entry.color);
      if (entry.position) entry.light.position.copy(entry.position);
      if (entry.shadowIntensity !== null && entry.light.shadow) {
        entry.light.shadow.intensity = entry.shadowIntensity;
      }
    }
    scene.environmentIntensity = environmentIntensity;
    shadowMap.autoUpdate = shadowAutoUpdate;
    shadowMap.needsUpdate = shadowNeedsUpdate;
  };
}

/**
 * 바다(OceanWater)의 유니폼을 캡처용으로 바꾸고 원복 함수를 돌려준다.
 * 직교 카메라에선 미러 패스가 돌지 않아 반사 RT 에 마지막 원근 프레임이
 * 남아 있으므로 `reflectionIntensity` 를 0 으로 두어 낡은 반사가 섞이지
 * 않게 하고, 태양 방향·색은 기준 조명과 같은 값(기준 태양·백색)으로 맞춘다.
 * 유니폼의 Vector3·Color 는 참조를 바꾸지 않고 제자리에서 고친다(SceneWater
 * 가 같은 참조를 들고 있다). 원복은 두 번 불러도 한 번만 적용된다.
 */
export function applyCanonicalWaterUniforms(
  water: OceanWater,
  sunDirection: Vector3,
): () => void {
  const {
    reflectionIntensity,
    sunDirection: sunUniform,
    sunColor,
  } = water.uniforms;
  const savedReflection = reflectionIntensity.value;
  const savedSunDirection = sunUniform.value.clone();
  const savedSunColor = sunColor.value.clone();
  reflectionIntensity.value = 0;
  sunUniform.value.copy(sunDirection);
  sunColor.value.copy(CANONICAL_WHITE);

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    reflectionIntensity.value = savedReflection;
    sunUniform.value.copy(savedSunDirection);
    sunColor.value.copy(savedSunColor);
  };
}
