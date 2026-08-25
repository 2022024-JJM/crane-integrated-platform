/**
 * outfitting 모듈이 소유하는 번역 조각.
 *
 * 이 공정의 문구는 여기에서만 고친다 — 공통 로케일 파일(shared/lib/i18n/locales)을
 * 건드리지 않으므로 다른 공정과 같은 줄에서 부딪히지 않는다.
 */
export const outfittingKo = {
  outfitting: {
    nav: { label: '선행의장' },
    zone: {
      displayName: '선행의장 공정',
      statusDetail: 'ot-pipeline-outfitting 가동 중 · 처리 자체는 멈추지 않음',
      healthDetail: '리더 2번 무응답 3분째 — 해당 구역 태그가 안 들어옴',
      ingest: '리더 3/4 온라인 (2번 무응답)',
      judge: '태그 누락으로 판정 보류 2건',
      store: 'Hot Data DB 커밋 지연 52ms',
      lastUpdate: '1분 전',
    },
  },
}
