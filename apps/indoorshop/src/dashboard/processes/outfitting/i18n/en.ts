import type { outfittingKo } from './ko'

/**
 * outfitting 모듈이 소유하는 번역 조각.
 *
 * 이 공정의 문구는 여기에서만 고친다 — 공통 로케일 파일(shared/lib/i18n/locales)을
 * 건드리지 않으므로 다른 공정과 같은 줄에서 부딪히지 않는다.
 */
export const outfittingEn: typeof outfittingKo = {
  outfitting: {
    nav: { label: 'Pre-outfitting' },
    zone: {
      displayName: 'Pre-outfitting',
      statusDetail: 'ot-pipeline-outfitting running · processing itself has not stopped',
      healthDetail: 'Reader #2 silent for 3 minutes — no tags from that area',
      ingest: 'Readers 3/4 online (#2 not responding)',
      judge: '2 judgements held back for missing tags',
      store: 'Hot Data DB commit latency 52 ms',
      lastUpdate: '1 min ago',
    },
  },
}
