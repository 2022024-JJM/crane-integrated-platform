/**
 * painting 모듈이 소유하는 번역 조각.
 *
 * 이 공정의 문구는 여기에서만 고친다 — 공통 로케일 파일(shared/lib/i18n/locales)을
 * 건드리지 않으므로 다른 공정과 같은 줄에서 부딪히지 않는다.
 */
export const paintingKo = {
  painting: {
    nav: { label: '선행도장' },
    workspace: {
      title: '선행도장 배치',
      subtitle: '도장 공장 지번 위에 설비 배치·운전 상태 — 공장을 고르거나 설비를 눌러 상세를 봅니다.',
      selectHint: '지도에서 설비를 누르면 상세가 열립니다',
      backToList: '설비 목록',
      equipmentCount: '설비 {{count}}대',
      summary: {
        running: '가동',
        online: '온라인',
        issues: '이상',
      },
      scada: {
        summary: '설비 요약',
        modules: '설비 모듈',
        registers: '레지스터',
        avgRh: '평균 습도',
        avgC: '평균 온도',
        lastPoll: '마지막 폴링',
      },
      demoHint: '운전 상태값은 실연동 전 모의(mock) 데이터입니다. 배치 좌표는 실측 근사값입니다.',
      polledAt: '{{time}} 갱신',
      layoutTitle: '{{factory}} 설비 배치',
      noMap: '배경 지도를 불러오지 못했습니다 — 설비 목록만 표시합니다.',
      approxNote: '설비 위치는 근사 배치입니다',
      hint3d: '공장 → 베이 → 설비 순으로 누르기 · Shift 또는 오른쪽 버튼 드래그로 회전',
      viewAll: '도장 전체 보기',
      viewAllHint: '도장 공장 전체가 보이는 자리로 돌아갑니다',
      factoriesTitle: '도장 공장',
      viewOnMap: '지도에서 이 공장 보기',
      expand: '펴기',
      collapse: '접기',
      legend: {
        dehumidifier: '제습기',
        gasHeater: '가스히터',
      },
      units: '{{count}}대',
      dehumCount: '제습기 {{count}}',
      heaterCount: '가스히터 {{count}}',
      operatingOf: '/ {{total}}대 가동 중',
      filter: {
        kindLegend: '설비 종류',
        all: '전체',
        onlyIssues: '이상만',
      },
      sort: {
        byId: '정렬: ID',
        byActual: '정렬: 실측값',
      },
      emptyList: '조건에 맞는 설비가 없습니다.',
      link: {
        online: '온라인',
        offline: '오프라인',
        error: '오류',
      },
      status: {
        operating: '가동 중',
        stopped: '정지',
        maint: '정비',
      },
      faultCode: 'Fault {{code}}',
      noFault: '정상',
      field: {
        setpoint: '설정값',
        actual: '실측값',
        runtime: '당일 가동',
        coords: '좌표',
        freshness: '최근 수신',
      },
      calcValue: '(계산값)',
      noSignal: '수신 없음',
      secondsAgo: '{{count}}초 전',
      stale: '지연',
    },
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
