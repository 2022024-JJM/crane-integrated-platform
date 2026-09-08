/**
 * fabrication 모듈이 소유하는 번역 조각.
 *
 * 이 공정의 문구는 여기에서만 고친다 — 공통 로케일 파일(shared/lib/i18n/locales)을
 * 건드리지 않으므로 다른 공정과 같은 줄에서 부딪히지 않는다.
 */
export const fabricationKo = {
  fabrication: {
    nav: { label: '가공' },
    zone: {
      displayName: '가공 공정',
      source: 'Legacy DB',
      statusDetail: 'ot-pipeline-fabrication 가동 중 · 5분 주기 폴링 정상',
      healthDetail: '필드 센서 없이 Legacy DB 연동만으로 판별 — 누락 0건',
      ingest: 'Legacy Oracle 조회 성공 · 마지막 5분 전',
      judge: '상태머신 fabrication.yml v2 · 실패 0건 / 1h',
      store: 'Hot Data DB 커밋 지연 38ms',
      lastUpdate: '5분 전',
    },
  },
}
