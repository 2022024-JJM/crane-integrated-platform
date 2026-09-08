import type { fabricationKo } from './ko'

/**
 * fabrication 모듈이 소유하는 번역 조각.
 *
 * 이 공정의 문구는 여기에서만 고친다 — 공통 로케일 파일(shared/lib/i18n/locales)을
 * 건드리지 않으므로 다른 공정과 같은 줄에서 부딪히지 않는다.
 */
export const fabricationEn: typeof fabricationKo = {
  fabrication: {
    nav: { label: 'Fabrication' },
    zone: {
      displayName: 'Fabrication',
      source: 'Legacy DB',
      statusDetail: 'ot-pipeline-fabrication running · 5-minute polling healthy',
      healthDetail: 'Judged from the legacy DB alone, no field sensors — nothing missing',
      ingest: 'Legacy Oracle query succeeded · last 5 min ago',
      judge: 'State machine fabrication.yml v2 · 0 failures / 1 h',
      store: 'Hot Data DB commit latency 38 ms',
      lastUpdate: '5 min ago',
    },
  },
}
