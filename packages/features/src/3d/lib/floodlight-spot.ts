import {
  floodlightAimDistance,
  resolveFloodlightAngle,
  resolveFloodlightIntensity,
  type SavedFloodlightInfo,
} from '@crane/domain/3d';
import { YARD_LIGHT_COLOR, type RgbTuple } from './sky-lighting';

/**
 * 씬에 놓인 투광등 → three SpotLight 파라미터.
 *
 * three 의 조명은 물리 단위다(r155+ 레거시 모드 없음): SpotLight 세기는
 * 칸델라이고 거리 d 의 조도는 I/d² 다. 저장값 `intensity` 는 "조준점에서의
 * 밝기 배율" 이라 높이와 무관하게 읽히도록, 조준 거리의 제곱을 곱해 칸델라로
 * 바꾼다 — 30 m 마스트와 50 m 마스트가 같은 배율이면 바닥 밝기가 같다.
 *
 * 기준 조도 FLOODLIGHT_AIM_IRRADIANCE 는 낮 방향광 세기(SCENE_LIGHTING_BASE
 * .sunIntensity 3.6)에 가까운 값이다 — 밤의 전역광은 바닥값(sky-lighting 의
 * YARD_LIGHT_INTENSITY_RATIO·NIGHT_*_LIT)이라 웅덩이가 낮 수준으로 환해야
 * 대비가 산다.
 * 값은 화면을 보고 맞춘다(ACES 톤매핑은 선형 합산으로 예측되지 않는다).
 */
export const FLOODLIGHT_AIM_IRRADIANCE = 3.2;
/**
 * 컷오프 거리 = 조준 거리 × 이 배. three 는 컷오프 근처에서 (1 − (d/cut)⁴)²
 * 로 부드럽게 0 이 되므로 조준점(1/2 지점)은 거의 깎이지 않고, 조준점 너머
 * 바닥까지 빛이 닿는다.
 */
export const FLOODLIGHT_CUTOFF_RATIO = 2;
/** 콘 가장자리 부드러움(SpotLight.penumbra, 0~1). */
export const FLOODLIGHT_PENUMBRA = 0.45;
/** 투광등 색 — 전역 작업등과 같은 따뜻한 백색. */
export const FLOODLIGHT_COLOR: RgbTuple = YARD_LIGHT_COLOR;
/**
 * 동시에 켤 SpotLight 슬롯 수. three 는 보이는 조명 수가 셰이더 상수라
 * 개수가 바뀌면 씬 머티리얼 전부가 재컴파일되므로 슬롯을 고정하고, 카메라
 * 초점에 가까운 조명을 슬롯에 배정한다(lib/floodlight-slots). 슬롯 밖 조명은
 * 기구 글로우만 보인다. 픽셀당 비용이 슬롯 수에 비례한다 — 지도급 씬에서
 * 10 이 상한의 근거이고 실측 뒤 조정한다.
 */
export const FLOODLIGHT_SLOT_COUNT = 10;

export interface FloodlightSpotParams {
  /** SpotLight.intensity(칸델라) — 점등 비율을 곱하기 전 값. */
  candela: number;
  /** SpotLight.distance(컷오프, 씬 unit). */
  distance: number;
  /** SpotLight.angle(라디안, 반각). */
  angle: number;
  penumbra: number;
}

export function resolveFloodlightSpot(
  light: SavedFloodlightInfo,
): FloodlightSpotParams {
  const aimDistance = floodlightAimDistance(light);
  const intensity = resolveFloodlightIntensity(light);
  return {
    candela: FLOODLIGHT_AIM_IRRADIANCE * intensity * aimDistance * aimDistance,
    distance: aimDistance * FLOODLIGHT_CUTOFF_RATIO,
    angle: (resolveFloodlightAngle(light) * Math.PI) / 180,
    penumbra: FLOODLIGHT_PENUMBRA,
  };
}
