import type { EquipmentOutlineState } from '@crane/core/types/status';
import type { ProximityPair } from './scene-proximity';

export type OutlineRecord = Record<string, EquipmentOutlineState>;

const LEVEL_TO_OUTLINE = { warn: 'slowdown', danger: 'endstop' } as const;
const RANK: Record<EquipmentOutlineState, number> = {
  none: 0,
  contour: 0.5,
  commError: 1,
  slowdown: 2,
  endstop: 3,
};

/**
 * 근접 쌍을 모델 외곽선 기록에 합친다 — 주의는 황(slowdown), 위험은 적(endstop)
 * 외곽선 종류를 그대로 빌린다. 이미 더 위험한 외곽선이 있으면 그대로 둔다.
 * 쌍이 없으면 입력 참조를 그대로 돌려줘 리렌더를 만들지 않는다.
 */
export function mergeProximityOutlines(
  base: OutlineRecord,
  pairs: readonly ProximityPair[],
  /** 상시 윤곽(contour)을 줄 모델 id — 관제 모드의 장비. null 이면 없음. */
  contour: readonly string[] | null = null,
): OutlineRecord {
  if (pairs.length === 0 && !contour?.length) return base;
  const out: OutlineRecord = { ...base };
  for (const id of contour ?? []) {
    if (RANK.contour > RANK[out[id] ?? 'none']) out[id] = 'contour';
  }
  for (const pair of pairs) {
    const kind = LEVEL_TO_OUTLINE[pair.level];
    for (const id of [pair.a, pair.b]) {
      const current = out[id] ?? 'none';
      if (RANK[kind] > RANK[current]) out[id] = kind;
    }
  }
  return out;
}
