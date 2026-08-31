/**
 * 한국어 리소스 — **번역의 기준(source of truth)**.
 *
 * 영어(`en.ts`)는 이 객체의 타입(`typeof ko`)을 그대로 따르므로, 여기에 키를 더하면
 * 영어 쪽을 채우기 전까지 컴파일이 통과하지 않는다 — 번역 누락이 런타임까지
 * 흘러가지 않게 하는 장치다.
 *
 * 키는 화면(area) 단위로 묶는다. 문장을 키로 쓰지 않는다: 한국어 문구를 고칠 때마다
 * 모든 참조를 함께 고쳐야 하기 때문이다.
 */
export const ko = {
  common: {
    fullscreenEnter: '전체 화면으로 보기 (F)',
    fullscreenExit: '전체 화면 나가기 (Esc)',
    loading: '불러오는 중',
    loadFailed: '데이터를 불러오지 못했습니다.',
    back: '뒤로',
    close: '닫기',
    none: '—',
    count: '{{count}}건',
    minutes: '약 {{count}}분',
    justNow: '방금 전',
    minutesAgo: '{{count}}분 전',
    hoursAgo: '{{count}}시간 전',
    daysAgo: '{{count}}일 전',
  },

  app: {
    name: '내업공정실적 자동수집 대시보드',
    shortName: '내업 공정실적',
    owner: '한화오션',
    organization: '한화에너지 컨버전스사업부 R&D센터',
    team: '솔루션개발1팀',
    copyright: '© {{years}} {{organization}}. All rights reserved.',
  },

  language: {
    label: '언어',
    description: '화면에 쓰는 언어를 고릅니다',
    ko: '한국어',
    en: 'English',
    koDescription: '국내 현장 표기 — 기본 언어',
    enDescription: '영문 표기 — 해외 협력사와 공유할 때',
  },

  nav: {
    mainNavigation: '메인 네비게이션',
    currentLocation: '현재 위치',
    openMenu: '메뉴 열기',
    closeMenu: '메뉴 닫기',
    expandSidebar: '메뉴바 펼치기',
    collapseSidebar: '메뉴바 접기',
    goToDashboard: '대시보드로 이동',
    collectionHealthy: '수집 정상',
    groups: {
      overview: '전체 현황',
      zones: '공정존',
      logistics: '물류',
      reference: '참고',
    },
    items: {
      dashboard: '대시보드',
      docs: '문서',
      settings: '설정',
    },
    notFound: '페이지를 찾을 수 없습니다',
    zoneBoard: '{{zone}} Field Data 수집 현황판',
  },

  header: {
    realtime: '실시간 수집',
    realtimeTitle: '수집 파이프라인 정상 — 센서 데이터가 계속 들어오는 중',
  },

  account: {
    menu: '계정 메뉴',
    role: '공정 모니터링 운영',
    userName: '운영 담당자',
    theme: '테마',
    fontSize: '글자 크기',
    fontSizeAria: '글자 크기 {{label}}',
    languageAria: '언어 {{label}}',
    settings: '설정',
  },

  theme: {
    light: '라이트',
    dark: '다크',
    system: '시스템',
    lightFull: '라이트 모드',
    darkFull: '다크 모드',
    systemFull: '시스템 설정',
    lightDescription: '항상 밝은 테마 사용',
    darkDescription: '항상 어두운 테마 사용',
    systemDescription: '운영체제 테마 따르기',
  },

  fontScale: {
    sm: '작게',
    md: '기본',
    lg: '크게',
    xl: '아주 크게',
    xlShort: '최대',
    smDescription: '한 화면에 더 많은 행을 담는다',
    mdDescription: '설계 기준 크기',
    lgDescription: '조금 떨어져서 보는 데스크 모니터',
    xlDescription: '현장 벽걸이 현황판',
    glyph: '가',
  },

  settings: {
    title: '설정',
    subtitle: '이 브라우저에만 저장됩니다 — 다른 사람이 보는 화면은 바뀌지 않습니다',
    themeTitle: '테마',
    themeDescription: '화면 밝기 계열을 고릅니다',
    themeGroupLabel: '테마 선택',
    fontSizeTitle: '글자 크기',
    fontSizeDescription: '화면 전체의 글자를 같은 비율로 키웁니다 (현재 {{percent}}%)',
    fontSizeGroupLabel: '글자 크기 선택',
    languageGroupLabel: '언어 선택',
    resetToDefault: '기본으로',
    preview: '미리보기',
    previewTitle: '조립 공정 · A공장 3정반',
    previewLine: '라이다 4대 정상 · 인식된 블록 12건 · 마지막 수집 2분 전',
    previewCode: 'WORK_CNTR A-03 · PROJ 2451 · BLK S12P',
    infoTitle: '정보',
    infoApp: '애플리케이션',
    infoVersion: '버전',
    infoOrganization: '조직',
  },

  alarms: {
    title: '알림',
    aria: '알림 {{count}}건',
    ariaEmpty: '알림',
    listLabel: '알림 목록',
    unreadCount: '안 읽은 알림 {{count}}건',
    allRead: '모두 확인했습니다',
    markAllRead: '모두 읽음',
    dismiss: '{{title}} 알림 지우기',
    empty: '알림이 없습니다',
    emptyFiltered: '이 조건에 맞는 알림이 없습니다',
    emptyHint: '수집 파이프라인이 조용하다는 뜻입니다',
    filters: {
      all: '전체',
      unread: '안 읽음',
      critical: '위험',
      warning: '주의',
    },
    severity: {
      critical: '위험',
      warning: '주의',
      info: '정보',
    },
    items: {
      'alm-1042': {
        title: '선행의장 리더 2번 응답 없음',
        message: '3분째 태그 이벤트가 들어오지 않습니다. 리더 전원·네트워크를 확인하세요.',
      },
      'alm-1041': {
        title: '조립 A공장 3번 정반 라이다 정합률 저하',
        message: '정합률 68% — 기준(80%) 아래입니다. 점군 겹침 구간을 확인하세요.',
      },
      'alm-1040': {
        title: 'Hot Data DB 쓰기 지연 증가',
        message: '평균 커밋 지연 480ms (기준 200ms). 적재는 계속되고 있습니다.',
      },
      'alm-1039': {
        title: '선행도장 Modbus 세션 재연결됨',
        message: 'PLC 연결이 한 차례 끊겼다가 12초 만에 복구되었습니다.',
      },
      'alm-1038': {
        title: '가공 Legacy DB 야간 배치 동기화 완료',
        message: '실적 1,284건을 통합했습니다. 누락 0건.',
      },
    },
  },

  dashboard: {
    title: '전체 현황',
    subtitle: '4개 공정존의 수집 상태를 확인하고 공장·작업 위치별 현황으로 이동합니다',
    zoneSection: '공정존 상태',
    zoneSectionDescription: '서비스 가동 여부와 수집 품질을 따로 봅니다',
    docsSection: '문서',
    docsSectionDescription: '레포의 마크다운 문서를 화면에서 바로 읽습니다',
    docsAll: '전체 {{count}}건',
    map: {
      currentLocation: '현 위치',
      returnToCurrentLocation: '기본 지도 위치로 돌아가기',
      loading: '지도 불러오는 중…',
      hint: '공장을 누르면 상세가 열립니다 · 빈 곳을 누르면 닫힙니다',
      hint3d: '공장을 누르면 베이 · 베이를 누르면 지번 상세 · Shift 또는 오른쪽 버튼 드래그로 회전',
      viewModeLegend: '보기 방식',
      view2d: '2D',
      view3d: '3D',
      minimap: '전체 야드',
      currentView: '현재 화면',
      minimapNavigate: '미니맵에서 이동할 위치 선택',
      processing: '처리 {{n}}건',
      zonesTitle: '공정존',
      openZone: '{{name}} 공정 화면 열기',
      openZoneShort: '공정 화면',
      viewOnMap: '지도에서 이 공정 보기',
      factoryOnMap: '지도에서 이 공장 보기',
      process: '공정',
      lots: '지번',
      area: '면적',
      indoor: '옥내',
      outdoor: '옥외',
      categories: '분류 구성',
      noFactory: '소속 공장 없음',
      noProcess: '공정 미지정',
      close: '닫기',
      factoryCount: '공장 {{n}}곳',
      legendTitle: '공정색',
      factoryListTitle: '공장 찾기',
      factoryListFiltered: '{{process}} 공장',
      showAll: '전체',
      factoriesLabel: '공장',
      lotCount: '지번 {{count}}',
      locationNoun: '작업 위치',
      locationCode: '정반코드',
      locationsOpenLabel: '작업 위치 — 누르면 현황 화면',
      locationsLoading: '작업 위치를 불러오는 중입니다.',
      locationsEmpty: '등록된 {{noun}}이(가) 없습니다.',
      locationsIdle: '공장을 고르면 {{noun}} 목록이 열립니다.',
      locationsError: '작업 위치를 불러오지 못했습니다.',
      locationsUnmapped: '이 공장은 공정 작업 위치와 연결돼 있지 않습니다.',
      locationsUnsupported: '작업 위치 상세는 준비 중입니다.',
      locationNoMapKey: '지도 위치 정보 없음',
      locationLotMissing: '지도 매핑 불일치',
      locationDeselect: '선택 해제',
      openLocationDetail: '현황 화면 열기',
      openFacility: '공장 현황 열기',
      retry: '다시 시도',
      bayCount: '{{count}}개 베이',
      expandAll: '전체 펴기',
      collapseAll: '전체 접기',
      expand: '펴기',
      collapse: '접기',
      selectedBay: '선택 베이',
      bayDeselect: '베이 선택 해제',
      bayLotList: '베이 지번',
      bayOpenLocation: '{{name}} 현황 열기',
      bayNoLinkedLocation: '이 베이와 연결된 {{noun}}이(가) 없습니다.',
      bayReopenHint: '지도에서 이 베이를 한 번 더 누르면 바로 열립니다.',
      bayLotSpotHint: '지도에서 이 지번 위치 짚어 보기',
    },
  },

  zone: {
    service: '서비스',
    quality: '수집 품질',
    processing: '처리 중',
    lastCollected: '마지막 수집',
    viewDetail: '상세 보기',
    legendToggleOpen: '표기 안내 보기',
    legendToggleClose: '표기 안내 닫기',
    legendServiceTitle: '서비스 — 프로세스가 도는가',
    legendServiceDescription: 'zone 판별 서비스의 actuator health 와 이벤트 처리 여부',
    legendQualityTitle: '수집 품질 — 제대로 걷는가',
    legendQualityDescription: '센서·브로커 연결, 수집 지연, 판별 실패율의 종합',
    statusTitle: '서비스 {{label}} — {{meaning}}',
    healthTitle: '수집 품질 {{label}} — {{meaning}}',
    status: {
      running: '실행 중',
      stopped: '정지',
      error: '오류',
    },
    statusMeaning: {
      running: '판별 서비스가 떠 있고 이벤트를 계속 처리하고 있음',
      stopped: '서비스가 내려가 있어 새 이벤트를 받지 않음',
      error: '서비스는 떠 있으나 예외로 처리가 멈춤',
    },
    health: {
      healthy: '정상',
      degraded: '주의',
      unhealthy: '불량',
    },
    healthMeaning: {
      healthy: '연결·지연·오류율이 모두 기준 안',
      degraded: '수집은 되지만 일부 지표가 기준을 벗어남',
      unhealthy: '수집이 사실상 끊긴 상태 — 실적 누락 가능',
    },
    checkState: {
      ok: '정상',
      warn: '주의',
      fail: '불량',
    },
    checkLabel: {
      ingest: '수집 경로',
      judge: '판별',
      store: '적재',
    },
  },


  zoneDetail: {
    goHome: '홈으로 돌아가기',
    boardTitle: '{{zone}} Field Data 수집 현황판',
    preparing: '준비 중입니다',
    preparingCard: '{{zone}} (준비 중)',
    planIntro: '이 페이지에서는 다음의 데이터를 수집·시각화할 예정입니다:',
    planItems: {
      lidar: 'LiDAR 센서 데이터',
      ocr: 'OCR 인식 결과',
      plc: 'PLC 데이터',
    },
    planNote: '추후 업데이트에서 실시간 데이터 수집 현황을 표시할 예정입니다.',
  },

  docs: {
    title: '문서',
    subtitle: '레포에 들어 있는 설계·규약 문서 {{count}}건을 화면 안에서 바로 읽습니다',
    search: '문서 검색',
    searchPlaceholder: '문서 제목·내용 요약으로 찾기',
    noMatch: '"{{query}}" 와(과) 맞는 문서가 없습니다',
    countBadge: '{{count}}건',
    list: '문서 목록',
    toc: '목차',
    tocLabel: '문서 목차',
    notFound: '문서를 찾을 수 없습니다',
    notFoundBody: '`{{id}}` 라는 문서가 레포에 없습니다. 아래 목록에서 고르세요.',
    goList: '문서 목록으로',
    noSummary: '설명이 없는 문서입니다',
    groups: {
      design: '설계 문서',
      convention: '개발 규약',
      frontend: '프론트엔드',
    },
  },

  notFound: {
    title: '페이지를 찾을 수 없습니다',
    description: '요청하신 주소에 해당하는 화면이 없습니다.',
    goHome: '대시보드로 돌아가기',
  },

  location: {
    status: {
      occupied: '작업중',
      empty: '공석',
      unknown: '미확인',
    },
  },






  route: {
    loading: '화면 불러오는 중',
  },
}

export type Resources = typeof ko
