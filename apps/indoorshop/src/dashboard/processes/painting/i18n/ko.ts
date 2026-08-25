/**
 * painting 모듈이 소유하는 번역 조각.
 *
 * 이 공정의 문구는 여기에서만 고친다 — 공통 로케일 파일(shared/lib/i18n/locales)을
 * 건드리지 않으므로 다른 공정과 같은 줄에서 부딪히지 않는다.
 */
export const paintingKo = {
  painting: {
    nav: { label: '선행도장' },
    zone: {
      displayName: '선행도장 공정',
      source: 'PLC · Modbus',
      statusDetail: 'ot-pipeline-painting 가동 중 · Modbus 폴링 1초 주기',
      healthDetail: '한 차례 재연결 뒤 안정 — 최근 30분 무중단',
      ingest: 'ISL Server Modbus Agent 연결 유지',
      judge: '상태머신 painting.yml v1 · 실패 0건 / 1h',
      store: 'Hot Data DB 커밋 지연 41ms',
      lastUpdate: '3분 전',
    },
  },
}
