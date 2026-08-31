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
      source: 'LiDAR',
      statusDetail: 'ot-pipeline-outfitting 가동 중 · 블록 관측 지속',
      healthDetail: 'LiDAR 2번 무응답 3분째 — 해당 구역 블록 갱신 지연',
      ingest: 'LiDAR 3/4 온라인 (2번 무응답)',
      judge: '스캔 누락으로 판정 보류 2건',
      store: 'Hot Data DB 커밋 지연 52ms',
      lastUpdate: '1분 전',
    },
    blockStatus: {
      inProgress: '작업중',
      completed: '완료',
      waiting: '대기',
    },
    sensorStatus: {
      online: '온라인',
      offline: '오프라인',
      error: '오류',
    },
    factoryList: {
      title: '선행의장 공정 — 공장 목록',
      subtitle: '공장을 고르면 그 공장의 블록별 작업 현황으로 들어갑니다.',
      loading: '공장 현황을 불러오는 중',
      loadFailed: '공장 현황을 불러오지 못했습니다.',
      summaryFactories: '공장',
      summaryFactoriesValue: '{{count}}개소',
      summaryBlocks: '블록',
      summaryBlocksValue: '작업중 {{inProgress}} / 총 {{total}}',
      summaryLidar: 'LiDAR',
      summaryLidarOk: '{{total}}대 전대수 정상',
      summaryLidarFault: '{{total}}대 중 {{fault}}대 점검',
      summaryLastScan: '최근 스캔',
    },
    factoryCard: {
      shop: '의장Shop {{code}}',
      areas: '구역 {{count}}개',
      blocks: '블록',
      blockUnit: '개',
      blocksDetail: '작업중 {{count}}',
      lidar: 'LiDAR',
      lidarOk: '전대수 정상',
      lidarFault: '{{count}}대 점검',
      completed: '완료',
      lastScan: '최근 스캔 {{time}}',
      statusComposition: '블록 상태 구성',
      factoryView: '공장 뷰',
    },
    workspace: {
      backToFactories: '공장 목록',
      notFound: '해당 공장을 찾을 수 없습니다.',
      blockSummary: '블록 {{total}}개 · 작업중 {{inProgress}} · 완료 {{completed}}',
      blockListTitle: '블록 현황',
      blockCount: '{{count}}개',
      noBlocks: '이 공장에 배정된 블록이 없습니다.',
      sensorSummaryTitle: 'LiDAR 센서',
    },
  },
}
