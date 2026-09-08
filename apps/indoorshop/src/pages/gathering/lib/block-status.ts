import type { FabResult, PntResult, TierKey } from '../model/types';

/** 가공 단계명 (요약 표기용) */
export const STAGE_NAMES = ['강재반입', '불출', '절단', '사상', '팔레트'];

/** 지연 %p → 상태 티어. 지연 = -5%p 이상 · 주의 = -1~4%p · 정상 = 계획 달성 */
export function stTier(delay: number): TierKey {
  return delay >= 5 ? 'delay' : delay > 0 ? 'warn' : 'ok';
}

/** 가공 현재 단계 인덱스 = 첫 미완료 단계 (전부 완료면 마지막 단계) */
export function fabCurIdx(f: FabResult): number {
  const i = f.rates.findIndex((r) => r < 100);
  return i < 0 ? 4 : i;
}

/** 블록 목록 행의 공정 요약 텍스트 */
export function stepTxt(
  f: FabResult,
  a: number | null,
  o: number | null,
  p: PntResult,
): { fab: string; asm: string; otf: string; pnt: string } {
  const fc = fabCurIdx(f);
  return {
    fab:
      f.total <= 0
        ? '—'
        : f.rates.every((r) => r >= 100)
          ? '완료'
          : `${STAGE_NAMES[fc]} ${f.rates[fc]}%`,
    asm: a == null ? '—' : `${a}%`,
    otf: o == null ? '—' : `${o}%`,
    pnt: p.done > 0 ? ['S/P', 'T/UP', 'FINAL'][p.done - 1] : '—',
  };
}
