import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 투광등(조명) — 에디터에서 바닥을 두 번 찍어 놓는 씬 객체. 첫 점 위로
 * 마스트 높이만큼 올린 자리가 기구(position), 두 번째 점이 비추는 자리다.
 * 밤(solar 모드의 작업등 점등 구간)에만 켜지고 낮에는 기구만 남는다 —
 * 켜고 끄는 옵션은 없다(야간 작업등은 항상 켠다는 결정과 같다).
 *
 * 비추는 자리는 기구 기준 **오프셋**(aim, 월드 축)으로 든다 — 기즈모·
 * 인스펙터로 기구를 옮기면 빛 웅덩이가 함께 따라간다(영역의 offset 과 같은
 * 발상). 회전·크기는 없다: 방향은 aim 이 정하고 크기는 콘 각도가 정한다.
 *
 * 단위: position·aim 은 씬 unit(scene-unit-scale.ts), 각도는 도, 세기는
 * 기준 밝기 배율(1 = 기준). 실제 SpotLight 파라미터(칸델라·컷오프)로 바꾸는
 * 것은 features 의 lib/floodlight-spot.ts 다 — 조명 세기는 취향·용도의
 * 문제라 도메인에 두지 않는다.
 *
 * 방어는 lib/sanitize-floodlights.ts, 기하(조준점·콘 윤곽)는 lib/floodlight.ts.
 */

/** 새 투광등의 마스트 높이(m). 놓을 때 씬 unit 으로 환산한다. */
export const FLOODLIGHT_HEIGHT_DEFAULT_M = 30;

/** 콘 반각(도) — SpotLight.angle 과 같은 뜻. 기본은 저장하지 않는다. */
export const FLOODLIGHT_ANGLE_DEFAULT = 35;
export const FLOODLIGHT_ANGLE_MIN = 5;
export const FLOODLIGHT_ANGLE_MAX = 80;

/** 세기 배율 — 1 이 기준 밝기. 기본은 저장하지 않는다. */
export const FLOODLIGHT_INTENSITY_DEFAULT = 1;
export const FLOODLIGHT_INTENSITY_MIN = 0.1;
export const FLOODLIGHT_INTENSITY_MAX = 5;

/** 기구에서 조준점까지 이보다 가까우면 방향이 없다 — 만들지 않는다(씬 unit). */
export const FLOODLIGHT_MIN_AIM_DISTANCE = 0.5;

export interface SavedFloodlightInfo {
  id: string;
  /** 계층 목록 표시 이름. 빈 문자열 허용 — 목록이 "Light" 로 폴백한다. */
  name: string;
  /** 기구(광원) 위치. */
  position: Vector3Tuple;
  /** 기구 → 조준점 오프셋(월드 축, 씬 unit). 길이 ≥ FLOODLIGHT_MIN_AIM_DISTANCE. */
  aim: Vector3Tuple;
  /** 콘 반각(도, [FLOODLIGHT_ANGLE_MIN, FLOODLIGHT_ANGLE_MAX]). 기본이면 생략. */
  angle?: number;
  /** 세기 배율([FLOODLIGHT_INTENSITY_MIN, FLOODLIGHT_INTENSITY_MAX]). 기본이면 생략. */
  intensity?: number;
  /** 편집 잠금 — 모델·텍스트와 같은 true-only 규칙. */
  locked?: boolean;
}
