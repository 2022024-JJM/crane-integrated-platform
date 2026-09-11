import { Vector3 } from 'three';
import { SCENE_SUN_ELEVATION_MIN } from '@crane/domain/3d';
import { clampToRange } from '@crane/core/lib/utils';

/**
 * 방위각·고도(도) → 태양 방향 벡터(씬 → 태양). 구성상 단위 벡터라
 * normalize가 필요 없다.
 *
 * 방위 규약: **월드 +X = 동, -Z = 북**, azimuth 0=북·90=동·180=남·270=서
 * (SavedLightingInfo 주석 참고). 기본값(az=180, el=SCENE_SUN_ELEVATION_DEFAULT)
 * 을 넣으면 종전 고정 조명 directionalPosition [0, 50, 10]의 방향이 부동소수
 * 오차 ~1e-16 이내로 재현된다 — lighting 필드가 없는 기존 씬의 셰이딩이
 * 유지되는 근거이며, SCENE_LIGHTING.directionalPosition을 지우지 않고 두는
 * 이유이기도 하다(이 일치의 기준점). 상세는 SCENE_SUN_ELEVATION_DEFAULT 주석.
 *
 * ui가 아닌 lib에 있는 이유: scene-render-preset.tsx는 컴포넌트 파일이라
 * 함수 export가 react-refresh(HMR) 규칙에 걸린다(scene-shadow.ts와 같은 사정).
 */
export function sunDirectionFromAngles(
  azimuthDeg: number,
  elevationDeg: number,
  /**
   * 고도 하한(도). 기본은 수동 패드와 같은 SCENE_SUN_ELEVATION_MIN. solar
   * 모드는 KEY_LIGHT_ELEVATION_MIN(10°)을, 하늘의 태양·달 표식은 −90 을
   * 넣어 실제 고도(지평선 아래 포함)를 그대로 쓴다.
   */
  minElevationDeg: number = SCENE_SUN_ELEVATION_MIN,
): Vector3 {
  const az = azimuthDeg * (Math.PI / 180);
  const el = clampToRange(elevationDeg, minElevationDeg, 90) * (Math.PI / 180);
  const cosEl = Math.cos(el);
  return new Vector3(Math.sin(az) * cosEl, Math.sin(el), -Math.cos(az) * cosEl);
}
