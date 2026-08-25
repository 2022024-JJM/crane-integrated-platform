import type { paintingKo } from './ko'

/**
 * painting 모듈이 소유하는 번역 조각.
 *
 * 이 공정의 문구는 여기에서만 고친다 — 공통 로케일 파일(shared/lib/i18n/locales)을
 * 건드리지 않으므로 다른 공정과 같은 줄에서 부딪히지 않는다.
 */
export const paintingEn: typeof paintingKo = {
  painting: {
    nav: { label: 'Pre-painting' },
    zone: {
      displayName: 'Pre-painting',
      source: 'PLC · Modbus',
      statusDetail: 'ot-pipeline-painting running · Modbus polling every second',
      healthDetail: 'Stable after one reconnect — no interruption in the last 30 minutes',
      ingest: 'ISL Server Modbus agent link held',
      judge: 'State machine painting.yml v1 · 0 failures / 1 h',
      store: 'Hot Data DB commit latency 41 ms',
      lastUpdate: '3 min ago',
    },
  },
}
