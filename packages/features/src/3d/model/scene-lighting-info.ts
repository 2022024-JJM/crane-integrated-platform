import type { Vector3, Vector3Tuple } from 'three';
import { SCENE_LIGHTING_BASE, type RgbTuple } from '../lib/sky-lighting';

/**
 * SceneLighting 이 매 프레임 내보내는 조명 상태 — manual·solar 두 모드 모두
 * 쓴다. useFrame 에서 쓰고 다른 useFrame 이 읽는 mutable 값이라 React 상태로
 * 두지 않는다(프레임 속도 setState 금지). 쓰는 쪽은 SceneLighting 하나뿐이다.
 *
 * 읽는 쪽은 바다(SceneWater)뿐이다: `sunDirection`/`sunColor`/`sunIntensity`
 * — 태양 하이라이트 유니폼. 튜플은 publishSunLight 가 값이 바뀔 때만 새로
 * 만드므로 읽는 쪽은 참조 비교로 변경을 감지한다. 미니맵 캡처는 기준(수동
 * 모드) 조명으로 찍어(lib/minimap-capture-lighting) 조명 상태를 읽지 않는다.
 */
export interface SceneLightingInfo {
  /** 태양 방향(단위 벡터, 고도 클램프 없음). manual 은 수동 태양. */
  sunDirection: Vector3Tuple;
  /** 태양 색(작업등 혼합 전). manual 은 백색. */
  sunColor: RgbTuple;
  /** 태양 세기. manual 은 SCENE_LIGHTING_BASE.sunIntensity(배율 1). */
  sunIntensity: number;
}

/**
 * SceneLighting 의 키 방향광(그림자를 드리우는 태양/작업등) 이름 — 미니맵
 * 캡처가 씬을 순회해 이 이름으로 찾아 캡처용 기준 조명으로 바꿨다 되돌린다.
 * fill 방향광은 이름이 없다.
 */
export const SCENE_KEY_LIGHT_NAME = 'scene-key-light';

export const sceneLightingInfo: SceneLightingInfo = {
  sunDirection: [0, 1, 0],
  sunColor: [1, 1, 1],
  sunIntensity: SCENE_LIGHTING_BASE.sunIntensity,
};

/**
 * 태양 방향·색·세기를 기록한다. 성분이 하나라도 다를 때만 **새 튜플**을
 * 대입하고(읽는 쪽의 참조 비교 근거), 같으면 참조를 유지한다. 세기도 다를
 * 때만 쓴다. 입력은 복사하므로 호출자가 Vector3·튜플을 재사용해도 된다.
 * NaN 은 그대로 기록된다(정화는 읽는 쪽 — resolveWaterSunUniforms).
 *
 * @returns 무엇이든 바뀌었는지.
 */
export function publishSunLight(
  info: SceneLightingInfo,
  direction: Vector3,
  color: RgbTuple,
  intensity: number,
): boolean {
  let changed = false;
  const prevDirection = info.sunDirection;
  if (
    prevDirection[0] !== direction.x ||
    prevDirection[1] !== direction.y ||
    prevDirection[2] !== direction.z
  ) {
    info.sunDirection = [direction.x, direction.y, direction.z];
    changed = true;
  }
  const prevColor = info.sunColor;
  if (
    prevColor[0] !== color[0] ||
    prevColor[1] !== color[1] ||
    prevColor[2] !== color[2]
  ) {
    info.sunColor = [color[0], color[1], color[2]];
    changed = true;
  }
  if (info.sunIntensity !== intensity) {
    info.sunIntensity = intensity;
    changed = true;
  }
  return changed;
}
