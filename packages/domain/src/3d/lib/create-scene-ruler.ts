import { RULER_DEFAULT_COLOR, type SavedRulerInfo } from '../model/ruler-types';
import { pickRulerInterval, type RulerPlacement } from './ruler';
import { createId } from '@crane/core/lib/create-id';

interface CreateSceneRulerParams {
  /** 두 점에서 계산한 배치(rulerPlacementFromPoints). */
  placement: RulerPlacement;
  /** 씬 1 unit 의 m(getSceneMetersPerUnit). 기본 간격을 m 길이로 고른다. */
  metersPerUnit: number;
  name?: string;
}

/**
 * 그린 눈금의 초기값 — 표시 옵션은 전부 기본(점과 숫자만, m 표시, 시작 값 0,
 * 보조선 없음). 간격만 그린 길이에 맞춰 고른다.
 */
export function createSceneRuler({
  placement,
  metersPerUnit,
  name = '',
}: CreateSceneRulerParams): SavedRulerInfo {
  const scale =
    Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 1;
  return {
    id: createId(),
    name,
    position: placement.position,
    rotation: placement.rotation,
    length: placement.length,
    interval: pickRulerInterval(placement.length * scale),
    textColor: RULER_DEFAULT_COLOR,
    dotColor: RULER_DEFAULT_COLOR,
  };
}
