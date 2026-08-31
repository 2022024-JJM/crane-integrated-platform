import type { Resources } from './ko'

/**
 * 영어 리소스.
 *
 * 타입이 `Resources`(= 한국어 리소스의 구조)로 묶여 있으므로 키를 빠뜨리면
 * 컴파일이 깨진다. 번역을 나중에 채울 생각으로 키를 지우지 말 것.
 *
 * 고유명사(호선·정반 코드, 서비스 이름, EMQX/Modbus 같은 제품명)는 옮기지 않는다 —
 * 현장에서 부르는 이름이 곧 그 값이라, 번역하면 서로 다른 것을 가리키게 된다.
 */
export const en: Resources = {
  common: {
    fullscreenEnter: 'Full screen (F)',
    fullscreenExit: 'Exit full screen (Esc)',
    loading: 'Loading',
    loadFailed: 'Failed to load data.',
    back: 'Back',
    close: 'Close',
    none: '—',
    count: '{{count}}',
    minutes: '~{{count}} min',
    justNow: 'just now',
    minutesAgo: '{{count}} min ago',
    hoursAgo: '{{count}} h ago',
    daysAgo: '{{count}} d ago',
  },

  app: {
    name: 'In-Shop Process Data Collection Dashboard',
    shortName: 'In-Shop Process',
    owner: 'Hanwha Ocean',
    organization: 'Hanwha Energy Convergence Business Division R&D Center',
    team: 'Solution Development Team 1',
    copyright: '© {{years}} {{organization}}. All rights reserved.',
  },

  language: {
    label: 'Language',
    description: 'Choose the language used across the app',
    ko: '한국어',
    en: 'English',
    koDescription: 'Korean — the default for the shop floor',
    enDescription: 'English — for sharing with overseas partners',
  },

  nav: {
    mainNavigation: 'Main navigation',
    currentLocation: 'Current location',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    expandSidebar: 'Expand sidebar',
    collapseSidebar: 'Collapse sidebar',
    goToDashboard: 'Go to dashboard',
    collectionHealthy: 'Collection healthy',
    groups: {
      overview: 'Overview',
      zones: 'Process zones',
      logistics: 'Logistics',
      reference: 'Reference',
    },
    items: {
      dashboard: 'Dashboard',
      docs: 'Docs',
      settings: 'Settings',
    },
    notFound: 'Page not found',
    zoneBoard: '{{zone}} field data collection board',
  },

  header: {
    realtime: 'Live collection',
    realtimeTitle: 'Collection pipeline healthy — sensor data is still arriving',
  },

  account: {
    menu: 'Account menu',
    role: 'Process monitoring operator',
    userName: 'Operator',
    theme: 'Theme',
    fontSize: 'Text size',
    fontSizeAria: 'Text size {{label}}',
    languageAria: 'Language {{label}}',
    settings: 'Settings',
  },

  theme: {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    lightFull: 'Light mode',
    darkFull: 'Dark mode',
    systemFull: 'System setting',
    lightDescription: 'Always use the light theme',
    darkDescription: 'Always use the dark theme',
    systemDescription: 'Follow the operating system',
  },

  fontScale: {
    sm: 'Small',
    md: 'Default',
    lg: 'Large',
    xl: 'Extra large',
    xlShort: 'Max',
    smDescription: 'Fits more rows on one screen',
    mdDescription: 'The size this UI was designed at',
    lgDescription: 'Desk monitor viewed from a distance',
    xlDescription: 'Wall-mounted shop floor board',
    glyph: 'A',
  },

  settings: {
    title: 'Settings',
    subtitle: 'Stored in this browser only — nobody else’s screen changes',
    themeTitle: 'Theme',
    themeDescription: 'Pick the brightness family of the interface',
    themeGroupLabel: 'Select theme',
    fontSizeTitle: 'Text size',
    fontSizeDescription: 'Scales every text style by the same ratio (now {{percent}}%)',
    fontSizeGroupLabel: 'Select text size',
    languageGroupLabel: 'Select language',
    resetToDefault: 'Reset',
    preview: 'Preview',
    previewTitle: 'Assembly · Shop A bay 3',
    previewLine: '4 LiDAR units healthy · 12 blocks detected · last collected 2 min ago',
    previewCode: 'WORK_CNTR A-03 · PROJ 2451 · BLK S12P',
    infoTitle: 'About',
    infoApp: 'Application',
    infoVersion: 'Version',
    infoOrganization: 'Organization',
  },

  alarms: {
    title: 'Alerts',
    aria: '{{count}} alerts',
    ariaEmpty: 'Alerts',
    listLabel: 'Alert list',
    unreadCount: '{{count}} unread',
    allRead: 'All caught up',
    markAllRead: 'Mark all read',
    dismiss: 'Dismiss alert: {{title}}',
    empty: 'No alerts',
    emptyFiltered: 'No alerts match this filter',
    emptyHint: 'That means the collection pipeline is quiet',
    filters: {
      all: 'All',
      unread: 'Unread',
      critical: 'Critical',
      warning: 'Warning',
    },
    severity: {
      critical: 'Critical',
      warning: 'Warning',
      info: 'Info',
    },
    items: {
      'alm-1042': {
        title: 'Pre-outfitting reader #2 not responding',
        message: 'No tag events for 3 minutes. Check the reader power and network.',
      },
      'alm-1041': {
        title: 'Assembly Shop A bay 3 — LiDAR registration rate dropped',
        message: 'Registration 68%, below the 80% threshold. Inspect the point cloud overlap.',
      },
      'alm-1040': {
        title: 'Hot Data DB write latency rising',
        message: 'Average commit latency 480 ms (threshold 200 ms). Writes are still going through.',
      },
      'alm-1039': {
        title: 'Pre-painting Modbus session reconnected',
        message: 'The PLC link dropped once and recovered after 12 seconds.',
      },
      'alm-1038': {
        title: 'Fabrication legacy DB nightly sync finished',
        message: '1,284 records merged. Nothing missing.',
      },
    },
  },

  dashboard: {
    title: 'Overview',
    subtitle: 'Check collection status across four process zones, then drill into a factory and work location',
    zoneSection: 'Process zone status',
    zoneSectionDescription: 'Service uptime and collection quality are judged separately',
    docsSection: 'Docs',
    docsSectionDescription: 'Read the repository markdown right here',
    docsAll: 'All {{count}} docs',
    map: {
      currentLocation: 'Current view',
      returnToCurrentLocation: 'Return to the default map position',
      loading: 'Loading map…',
      hint: 'Select a factory for details · click empty space to close',
      hint3d: 'Select a factory for bays · select a bay for parcels · Shift or right-drag to orbit',
      viewModeLegend: 'View mode',
      view2d: '2D',
      view3d: '3D',
      minimap: 'Yard overview',
      currentView: 'Current view',
      minimapNavigate: 'Choose a location to move to on the minimap',
      processing: '{{n}} processed',
      zonesTitle: 'Process zones',
      openZone: 'Open the {{name}} process view',
      openZoneShort: 'Process view',
      viewOnMap: 'Show this process on the map',
      factoryOnMap: 'Show this factory on the map',
      process: 'Process',
      lots: 'Parcels',
      area: 'Area',
      indoor: 'Indoor',
      outdoor: 'Outdoor',
      categories: 'Category mix',
      noFactory: 'No factory assigned',
      noProcess: 'Unassigned',
      close: 'Close',
      factoryCount: '{{n}} factories',
      legendTitle: 'Process colors',
      factoryListTitle: 'Find a factory',
      factoryListFiltered: '{{process}} factories',
      showAll: 'All',
      factoriesLabel: 'Factories',
      lotCount: '{{count}} lots',
      locationNoun: 'Work location',
      locationCode: 'Jig code',
      locationsOpenLabel: 'Work locations — open the status view',
      locationsLoading: 'Loading work locations…',
      locationsEmpty: 'No {{noun}} registered.',
      locationsIdle: 'Pick a factory to list its {{noun}}.',
      locationsError: 'Could not load work locations.',
      locationsUnmapped: 'This factory is not linked to any process work location.',
      locationsUnsupported: 'Work location details are not available yet.',
      locationNoMapKey: 'No map location',
      locationLotMissing: 'Map mapping mismatch',
      locationDeselect: 'Clear',
      openLocationDetail: 'Open status view',
      openFacility: 'Open factory status',
      retry: 'Retry',
      bayCount: '{{count}} bays',
      expandAll: 'Expand all',
      collapseAll: 'Collapse all',
      expand: 'Expand',
      collapse: 'Collapse',
      selectedBay: 'Selected bay',
      bayDeselect: 'Clear bay selection',
      bayLotList: 'Parcels in this bay',
      bayOpenLocation: 'Open {{name}}',
      bayNoLinkedLocation: 'No {{noun}} is linked to this bay.',
      bayReopenHint: 'Click this bay again on the map to open it.',
      bayLotSpotHint: 'Point out this parcel on the map',
    },
  },

  zone: {
    service: 'Service',
    quality: 'Collection quality',
    processing: 'In progress',
    lastCollected: 'Last collected',
    viewDetail: 'View details',
    legendToggleOpen: 'Show legend',
    legendToggleClose: 'Hide legend',
    legendServiceTitle: 'Service — is the process running',
    legendServiceDescription: 'Actuator health of the zone judging service and whether it processes events',
    legendQualityTitle: 'Collection quality — is it walking straight',
    legendQualityDescription: 'Sensor and broker links, collection lag, and judging failure rate combined',
    statusTitle: 'Service {{label}} — {{meaning}}',
    healthTitle: 'Collection quality {{label}} — {{meaning}}',
    status: {
      running: 'Running',
      stopped: 'Stopped',
      error: 'Error',
    },
    statusMeaning: {
      running: 'The judging service is up and keeps processing events',
      stopped: 'The service is down and accepts no new events',
      error: 'The service is up but processing halted on an exception',
    },
    health: {
      healthy: 'Healthy',
      degraded: 'Warning',
      unhealthy: 'Failing',
    },
    healthMeaning: {
      healthy: 'Links, latency, and error rate are all within thresholds',
      degraded: 'Data still arrives, but some metric is outside its threshold',
      unhealthy: 'Collection is effectively cut off — records may be lost',
    },
    checkState: {
      ok: 'OK',
      warn: 'Warning',
      fail: 'Failing',
    },
    checkLabel: {
      ingest: 'Ingest path',
      judge: 'Judging',
      store: 'Storage',
    },
  },


  zoneDetail: {
    goHome: 'Back to the dashboard',
    boardTitle: '{{zone}} field data collection board',
    preparing: 'Under construction',
    preparingCard: '{{zone}} (under construction)',
    planIntro: 'This screen will collect and visualise:',
    planItems: {
      lidar: 'LiDAR sensor data',
      ocr: 'OCR recognition results',
      plc: 'PLC data',
    },
    planNote: 'Live collection status will appear here in a later update.',
  },

  docs: {
    title: 'Docs',
    subtitle: 'Read the {{count}} design and convention documents from the repository right here',
    search: 'Search documents',
    searchPlaceholder: 'Search by title or summary',
    noMatch: 'No document matches “{{query}}”',
    countBadge: '{{count}}',
    list: 'Document list',
    toc: 'Contents',
    tocLabel: 'Table of contents',
    notFound: 'Document not found',
    notFoundBody: 'There is no document named `{{id}}` in the repository. Pick one below.',
    goList: 'Back to the document list',
    noSummary: 'This document has no summary',
    groups: {
      design: 'Design documents',
      convention: 'Development conventions',
      frontend: 'Frontend',
    },
  },

  notFound: {
    title: 'Page not found',
    description: 'There is no screen at that address.',
    goHome: 'Back to the dashboard',
  },

  location: {
    status: {
      occupied: 'In work',
      empty: 'Empty',
      unknown: 'Unknown',
    },
  },






  route: {
    loading: 'Loading screen',
  },
}
