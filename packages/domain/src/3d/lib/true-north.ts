/**
 * 씬의 진북 — 지리 방위(나침반 각)와 월드 방위(월드 −Z 기준 시계 방향 각)
 * 사이의 변환. 나침반 표시와 태양(solar·수동)·달 방향이 이 파일 하나를 본다.
 *
 * 월드 방위 규약은 sun-direction.ts 와 같다: 0 = −Z, 90 = +X (탑뷰 화면
 * 위쪽에서 시계 방향). 진북이 월드 방위 N° 에 있으면, 지리 방위 b° 인
 * 방향은 월드 방위 (b + N)° 다.
 */
import { SCENE_TRUE_NORTH_DEFAULT, type SavedSceneInfo } from '../model/types';
import { normalizeDegrees } from './math-utils';

/**
 * 씬의 진북(월드 방위, [0,360)). 필드가 없거나 유한수가 아니면 기본값
 * (−Z 가 북). 로드 경계의 sanitize 를 거치지 않은 편집 중 상태도 받는다.
 */
export function resolveTrueNorth(
  sceneInfo: Pick<SavedSceneInfo, 'trueNorth'> | null | undefined,
): number {
  const raw = sceneInfo?.trueNorth;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return SCENE_TRUE_NORTH_DEFAULT;
  }
  return normalizeDegrees(raw);
}

/** 지리 방위(도) → 월드 방위(도, [0,360)). 비유한 입력은 0 으로 방어한다. */
export function bearingToWorldAzimuth(
  bearingDeg: number,
  trueNorthDeg: number,
): number {
  return normalizeDegrees(bearingDeg + trueNorthDeg);
}
