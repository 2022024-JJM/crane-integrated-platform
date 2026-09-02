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
      source: 'LiDAR',
      statusDetail: 'ot-pipeline-outfitting running · block observation ongoing',
      healthDetail: 'LiDAR #2 silent for 3 minutes — block updates delayed in that area',
      ingest: 'LiDAR 3/4 online (#2 not responding)',
      judge: '2 judgements held back for missing scans',
      store: 'Hot Data DB commit latency 52 ms',
      lastUpdate: '1 min ago',
    },
    blockStatus: {
      inProgress: 'In progress',
      completed: 'Completed',
      waiting: 'Waiting',
    },
    sensorStatus: {
      online: 'Online',
      offline: 'Offline',
      error: 'Error',
    },
    mapEntry: {
      title: 'Pre-outfitting layout',
      subtitle:
        'Block work status on outfitting factory parcels — pick a factory, then a bay for its blocks.',
      listLink: 'Factory list',
      factoriesTitle: 'Outfitting factories',
      viewAll: 'View all outfitting',
      viewAllHint: 'Return to the view showing every outfitting factory',
      viewOnMap: 'View this factory on the map',
      expand: 'Expand',
      collapse: 'Collapse',
      summary: { running: 'in progress' },
      blockDetail: 'Block detail',
      bay: {
        blocksTitle: 'Blocks in this bay',
        noBlocks: 'No blocks assigned to this bay.',
      },
      viewer: {
        open: 'Bay 3D view (mock)',
        title: '{{factory}} · {{bay}}',
        hint: 'A mock scene in the same grammar as the assembly bay view',
        close: 'Close 3D view',
        mockChip: 'Mock data — real outfitting scans not wired in yet',
        rowHint: 'Open the 3D view of this bay',
      },
      hint3d: 'Click factory → bay → block · rotate with Shift or right-button drag',
      mockNote: 'Block status/progress is mock data until live integration',
    },
    factoryList: {
      title: 'Pre-outfitting — Factory list',
      subtitle: 'Pick a factory to see its block-by-block work status.',
      loading: 'Loading factory status',
      loadFailed: 'Failed to load factory status.',
      summaryFactories: 'Factories',
      summaryFactoriesValue: '{{count}}',
      summaryBlocks: 'Blocks',
      summaryBlocksValue: '{{inProgress}} in progress / {{total}} total',
      summaryLidar: 'LiDAR',
      summaryLidarOk: '{{total}} all healthy',
      summaryLidarFault: '{{fault}} of {{total}} need attention',
      summaryLastScan: 'Last scan',
    },
    factoryCard: {
      shop: 'Outfit shop {{code}}',
      areas: '{{count}} areas',
      blocks: 'Blocks',
      blockUnit: '',
      blocksDetail: '{{count}} in progress',
      lidar: 'LiDAR',
      lidarOk: 'All healthy',
      lidarFault: '{{count}} to check',
      completed: 'Completed',
      lastScan: 'Last scan {{time}}',
      statusComposition: 'Block status',
      factoryView: 'Factory view',
    },
    workspace: {
      backToFactories: 'Factory list',
      notFound: 'Factory not found.',
      blockSummary: '{{total}} blocks · {{inProgress}} in progress · {{completed}} done',
      blockListTitle: 'Blocks',
      blockCount: '{{count}}',
      noBlocks: 'No blocks assigned to this factory.',
      sensorSummaryTitle: 'LiDAR sensors',
    },
  },
}
