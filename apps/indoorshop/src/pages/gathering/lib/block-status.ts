import type { FabResult, TierKey } from '../model/types';

/** 지연 %p → 티어. 지연 = 계획 대비 -5%p 이상, 주의 = -1~4%p, 정상 = 달성 */
export function stTier(delay: number): TierKey {
  return delay >= 5 ? 'delay' : delay > 0 ? 'warn' : 'ok';
}

/** 가공 현재 단계 인덱스 (모두 100%면 마지막 단계) */
export function fabCurIdx(f: FabResult): number {
  const cur = f.rates.findIndex((r) => r < 100);
  return cur < 0 ? 4 : cur;
}
