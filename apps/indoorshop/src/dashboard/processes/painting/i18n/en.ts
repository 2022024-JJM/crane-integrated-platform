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
    workspace: {
      title: 'Painting status',
      subtitle:
        'Equipment layout and running state over painting factory parcels — pick a factory or click equipment for detail.',
      selectHint: 'Click equipment on the map to open its detail',
      backToList: 'Equipment list',
      equipmentCount: '{{count}} units',
      summary: {
        running: 'running',
        online: 'online',
        issues: 'issues',
      },
      scada: {
        summary: 'Equipment summary',
        modules: 'Equipment modules',
        registers: 'Registers',
        avgRh: 'Avg humidity',
        avgC: 'Avg temp',
        lastPoll: 'Last poll',
      },
      demoHint:
        'Running-state values are mock data shown before live integration. Placement coordinates are approximate.',
      polledAt: 'updated {{time}}',
      layoutTitle: '{{factory}} equipment layout',
      noMap: 'Background map failed to load — showing the equipment list only.',
      approxNote: 'Equipment positions are approximate',
      hint3d: 'Factory → bay → equipment · Shift or right-drag to orbit',
      viewAll: 'All painting factories',
      viewAllHint: 'Return to the view showing every painting factory',
      factoriesTitle: 'Painting factories',
      viewOnMap: 'View this factory on the map',
      expand: 'Expand',
      collapse: 'Collapse',
      legend: {
        dehumidifier: 'Dehumidifier',
        gasHeater: 'Gas heater',
      },
      units: '{{count}} units',
      dehumCount: 'Dehum. {{count}}',
      heaterCount: 'Heater {{count}}',
      operatingOf: '/ {{total}} running',
      filter: {
        kindLegend: 'Equipment kind',
        all: 'All',
        onlyIssues: 'Issues only',
      },
      sort: {
        byId: 'Sort: ID',
        byActual: 'Sort: actual',
      },
      emptyList: 'No equipment matches the filter.',
      link: {
        online: 'Online',
        offline: 'Offline',
        error: 'Error',
      },
      status: {
        operating: 'Running',
        stopped: 'Stopped',
        maint: 'Maint',
      },
      faultCode: 'Fault {{code}}',
      noFault: 'Normal',
      field: {
        setpoint: 'Setpoint',
        actual: 'Actual',
        runtime: 'Runtime today',
        coords: 'Coordinates',
        freshness: 'Last received',
      },
      calcValue: '(calculated)',
      noSignal: 'No signal',
      secondsAgo: '{{count}}s ago',
      stale: 'stale',
    },
    mapEntry: {
      modeLabel: 'Panel mode',
      modeEquipment: '① Equipment',
      modeCollection: '② Collection',
      collection: {
        detected: 'Detected blocks',
        wo: 'W/O',
        steps: 'Step nodes',
        dailyRate: 'Daily progress',
        lastScan: 'Last collection',
        openFactory: 'Open factory status',
        noBlocks: 'No blocks are assigned to this painting factory yet — they appear once BTS records an inbound move.',
        activeStep: 'Active',
        noActiveStep: 'No step in progress',
        stepsUnit: 'nodes',
        inProgressBlocks: '{{count}} block(s) in progress',
      },
      equipment: {
        scadaHeading: 'SCADA equipment',
        members: 'Members',
        empty: 'No equipment is registered for this factory.',
        noTransferred:
          'Transferred equipment (panels, Edge PCs, PLCs, hubs) is not deployed to painting factories yet.',
        issueCount: '{{count}} with issues',
        issueWarning:
          '{{count}} transferred unit(s) in trouble — the equipment behind them can go blind too.',
      },
    },
    factoryStatus: {
      notFound: 'Unknown painting factory.',
      backToMap: 'Painting status',
      blockSummary: '{{total}} block(s) in shop · {{inProgress}} in progress',
      stepSummary: 'Steps done {{done}}/{{total}}',
      stepProgressTitle: 'Step progress (S/P → T/UP → FINAL)',
      stepNotPlanned: 'No block in this factory plans this step',
      stepInProgress: '{{count}} block(s) in progress',
      blockListTitle: 'Blocks (BTS attribution)',
      noBlocks: 'No blocks are assigned to this painting factory.',
      btsNote: 'Location and inbound/outbound come from BTS logistics — not the ZONE mapping table.',
      equipmentTitle: 'Equipment summary',
      openScada: 'View equipment status on the map',
    },
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
