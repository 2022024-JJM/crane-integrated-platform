import type { InshopKey } from '../../../lib/i18n/keys'
import type { FabStageId } from '../model/types'

/**
 * 가공 정본 10절점의 라벨·근거 i18n 키 (R33).
 *
 * 절점 카드(`StageCards`)와 헤더 절점 스트립(`NodeStrip`)이 **같은 이름**을 써야 해서
 * 한 곳에 둔다 — 예전엔 카드에만 이름이 있어 스트립은 코드(S1…)만 말했고, 두 화면이
 * 같은 절점을 다른 낱말로 부를 수 있었다.
 */
export const FAB_STAGE_LABEL_KEY: Record<FabStageId, InshopKey> = {
  S1: 'performance.stages.s1',
  S2: 'performance.stages.s2',
  S3: 'performance.stages.s3',
  S4: 'performance.stages.s4',
  S5: 'performance.stages.s5',
  S6: 'performance.stages.s6',
  S7: 'performance.stages.s7',
  S8: 'performance.stages.s8',
  S9: 'performance.stages.s9',
  S10: 'performance.stages.s10',
}

export const FAB_STAGE_BASIS_KEY: Record<FabStageId, InshopKey> = {
  S1: 'performance.stages.basisOf.S1',
  S2: 'performance.stages.basisOf.S2',
  S3: 'performance.stages.basisOf.S3',
  S4: 'performance.stages.basisOf.S4',
  S5: 'performance.stages.basisOf.S5',
  S6: 'performance.stages.basisOf.S6',
  S7: 'performance.stages.basisOf.S7',
  S8: 'performance.stages.basisOf.S8',
  S9: 'performance.stages.basisOf.S9',
  S10: 'performance.stages.basisOf.S10',
}
