import type { SavedFloodlightInfo } from '../model/floodlight-types';
import type { FloodlightPlacement } from './floodlight';
import { createId } from '@crane/core/lib/create-id';

interface CreateSceneFloodlightParams {
  /** 두 점에서 계산한 배치(floodlightPlacementFromPoints). */
  placement: FloodlightPlacement;
  name?: string;
}

/**
 * 놓은 투광등의 초기값 — 각도·세기는 기본(필드 생략). 이름은 호출자가
 * 번역해 넘긴다("조명 1").
 */
export function createSceneFloodlight({
  placement,
  name = '',
}: CreateSceneFloodlightParams): SavedFloodlightInfo {
  return {
    id: createId(),
    name,
    position: placement.position,
    aim: placement.aim,
  };
}
