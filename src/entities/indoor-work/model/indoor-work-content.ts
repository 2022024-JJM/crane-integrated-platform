import { createElement } from 'react';

import {
  createMonitoringStatusTable,
  MonitoringStatusDot,
  type MonitoringStatusColumn,
  type MonitoringStatusTableData,
} from '@/entities/monitoring/crane-status';
import type {
  IndoorAlarmRow,
  IndoorCraneRow,
  IndoorInfoCard,
  IndoorInfoRow,
  IndoorStatCard,
  IndoorStatusCard,
  IndoorStatusRow,
} from '@/entities/indoor-work/model/types';
import type { MonitoringMenuKey } from '@/entities/monitoring/menu/model/types';

export const INDOOR_WORK_TEXT = {
  alarmTitle: '알람 내역',
  live: '온라인',
  sidebarTitle: '내업',
  statsTitle: '알람 통계',
  topDescription: '창고 · 실내 설비 3D 모니터링',
  topTag: '실내 작업 모니터링',
  viewerTitle: '3D CRANE VIEW',
} as const;

export const INDOOR_WORK_VIEWER_SUBTITLE_MAP: Record<
  MonitoringMenuKey,
  string
> = {
  'event-log': '이벤트 로그 · 최근 발생 이력',
  'operation-info': '운행 정보 · 설비 위치 · 작업 구간',
  'operation-status': '운행 현황 · 장비 상태 · 이벤트 흐름',
  playback: '다시 보기 · 과거 시점 재생',
  'realtime-monitoring': '',
  'screen-editor': '화면 편집 · 배치 및 패널 구성',
};

export const INDOOR_WORK_LOWER_PANEL_TITLE_MAP: Record<
  MonitoringMenuKey,
  string
> = {
  'event-log': '이벤트 로그 목록',
  'operation-info': '장비 운행 정보',
  'operation-status': '운행 상태 이력',
  playback: '재생 구간 요약',
  'realtime-monitoring': '실시간 장비 상태 테이블',
  'screen-editor': '패널 배치 정보',
};

export const INDOOR_WORK_STAT_CARDS = [
  { label: '# Alarms', value: '2', tone: 'danger' },
  { label: 'Elapsed Time', value: '3 min', tone: 'neutral' },
  { label: '# Occurrence', value: '1', tone: 'ok' },
  { label: 'Abnormal', value: '2', tone: 'danger' },
  { label: 'Danger', value: '1', tone: 'danger' },
  { label: 'Normal', value: '0', tone: 'ok' },
] satisfies readonly IndoorStatCard[];

export const INDOOR_WORK_ALARM_ROWS = [
  ['88', 'Normal', '2019-01-23 14:55', 'BL-01', '1'],
  ['87', 'Warning', '2019-01-23 14:48', 'BL-03', '2'],
  ['86', 'Warning', '2019-01-23 14:40', 'OHC-11', '3'],
  ['85', 'Critical', '2019-01-23 14:31', 'OHC-07', '1'],
  ['84', 'Normal', '2019-01-23 14:22', 'BL-05', '2'],
  ['83', 'Warning', '2019-01-23 14:15', 'OHC-02', '1'],
] satisfies readonly IndoorAlarmRow[];

export const INDOOR_WORK_CRANE_ROWS = [
  {
    equipment: 'OHC-01',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '12.5',
    trolley2: '',
    gantry: '18.4',
    hoist1: '22.1',
    hoist2: '',
    hoist3: '34.2',
    trolley2Secondary: '',
    slewing: '112.3',
    gantrySecondary: '8.2',
  },
  {
    equipment: 'OHC-02',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '30.1',
    trolley2: '',
    gantry: '22',
    hoist1: '',
    hoist2: '',
    hoist3: '58.7',
    trolley2Secondary: '',
    slewing: '230.1',
    gantrySecondary: '5.5',
  },
  {
    equipment: 'OHC-07',
    comm: true,
    on: true,
    fault: true,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '',
    trolley2: '95.3',
    gantry: '35',
    hoist1: '',
    hoist2: '42.1',
    hoist3: '',
    trolley2Secondary: '95.3',
    slewing: '415.9',
    gantrySecondary: '-0.3',
  },
  {
    equipment: 'OHC-11',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '',
    trolley2: '72',
    gantry: '28.5',
    hoist1: '',
    hoist2: '19.8',
    hoist3: '',
    trolley2Secondary: '72',
    slewing: '508.4',
    gantrySecondary: '3.8',
  },
  {
    equipment: 'OHC-14',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: true,
    rotate: false,
    trolley1: '',
    trolley2: '210.5',
    gantry: '0',
    hoist1: '',
    hoist2: '8.3',
    hoist3: '',
    trolley2Secondary: '210.5',
    slewing: '0',
    gantrySecondary: '0',
  },
  {
    equipment: 'BL-01',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '5.8',
    trolley2: '22.1',
    gantry: '14.2',
    hoist1: '10.5',
    hoist2: '',
    hoist3: '22.1',
    trolley2Secondary: '',
    slewing: '178.6',
    gantrySecondary: '12.1',
  },
  {
    equipment: 'BL-03',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '',
    trolley2: '140.3',
    gantry: '16',
    hoist1: '',
    hoist2: '30.7',
    hoist3: '',
    trolley2Secondary: '140.3',
    slewing: '320.5',
    gantrySecondary: '0',
  },
] satisfies readonly IndoorCraneRow[];

export const INDOOR_WORK_OPERATION_INFO_CARDS = [
  ['도크명', '1도크 / Indoor Storage'],
  ['활성 장비', 'OHC 4기, Bay Lift 2기'],
  ['현재 작업', '창고 반입 · 베이 이송'],
  ['작업 구간', '1Bay ~ 3Bay / 조립 5공장'],
] satisfies readonly IndoorInfoCard[];

export const INDOOR_WORK_OPERATION_INFO_ROWS = [
  {
    equipment: 'OHC-01',
    equipmentType: 'Overhead Crane',
    location: '3Bay',
    status: '정상',
    task: '반입 적재',
    direction: '동측',
  },
  {
    equipment: 'OHC-07',
    equipmentType: 'Overhead Crane',
    location: '1Bay',
    status: '주의',
    task: '라인 이송',
    direction: '중앙',
  },
  {
    equipment: 'BL-01',
    equipmentType: 'Bay Lift',
    location: '2Bay',
    status: '정상',
    task: '자재 이동',
    direction: '서측',
  },
  {
    equipment: 'BL-03',
    equipmentType: 'Bay Lift',
    location: '1Bay',
    status: '정상',
    task: '적재 완료',
    direction: '남측',
  },
] satisfies readonly IndoorInfoRow[];

export const INDOOR_WORK_OPERATION_STATUS_CARDS = [
  ['총 운행 장비', '9', 'neutral'],
  ['정상 장비', '6', 'ok'],
  ['주의 장비', '2', 'danger'],
  ['점검 장비', '1', 'danger'],
] satisfies readonly IndoorStatusCard[];

export const INDOOR_WORK_OPERATION_STATUS_ROWS = [
  {
    time: '09:05',
    equipment: 'OHC-01',
    statusChange: '횡행 이동 시작',
    level: '정상',
    location: '3Bay 상단',
  },
  {
    time: '09:12',
    equipment: 'OHC-07',
    statusChange: '권상 속도 편차',
    level: '주의',
    location: '1Bay 중앙',
  },
  {
    time: '09:16',
    equipment: 'BL-01',
    statusChange: '베이간 이송 완료',
    level: '정상',
    location: '2Bay',
  },
  {
    time: '09:19',
    equipment: 'OHC-14',
    statusChange: '점검 모드 전환',
    level: '점검',
    location: '3Bay 후면',
  },
  {
    time: '09:22',
    equipment: 'BL-03',
    statusChange: '자재 반입 대기',
    level: '정상',
    location: '1Bay',
  },
] satisfies readonly IndoorStatusRow[];

export const INDOOR_WORK_OPERATION_INFO_NOTES = [
  '1Bay 반입 라인 우선순위 상향',
  'OHC-14는 점검 모드 유지',
  'BL-01 자재 이송 사이클 정상',
  '3Bay 상부 센서 응답 0.6s',
] as const;

export const INDOOR_WORK_OPERATION_STATUS_SUMMARY = [
  '정상 장비 비율 66%',
  '주의 레벨 2건 유지',
  '점검 장비 1건 대응 중',
  '평균 베이 이송 응답 0.74s',
] as const;

const EMPHASIS_CELL_CLASS =
  'font-bold text-[var(--outdoor-page-table-emphasis)]';

const LEFT_EMPHASIS_CELL_CLASS =
  'text-left font-bold text-[var(--outdoor-page-table-emphasis)]';

const MONITORING_STATUS_COLUMNS: readonly MonitoringStatusColumn<IndoorCraneRow>[] =
  [
    {
      id: 'equipment',
      header: 'Crane',
      cellClassName: LEFT_EMPHASIS_CELL_CLASS,
      renderCell(row) {
        return row.equipment;
      },
    },
    {
      id: 'comm',
      header: 'Comm',
      renderCell(row) {
        return createElement(MonitoringStatusDot, {
          tone: row.comm ? 'ok' : 'idle',
        });
      },
    },
    {
      id: 'on',
      header: 'On',
      renderCell(row) {
        return createElement(MonitoringStatusDot, {
          tone: row.on ? 'ok' : 'idle',
        });
      },
    },
    {
      id: 'fault',
      header: 'Fault',
      renderCell(row) {
        return createElement(MonitoringStatusDot, {
          tone: row.fault ? 'danger' : 'idle',
        });
      },
    },
    {
      id: 'notComm',
      header: 'Not Comm',
      renderCell(row) {
        return createElement(MonitoringStatusDot, {
          tone: row.notComm ? 'danger' : 'idle',
        });
      },
    },
    {
      id: 'freeSlewing',
      header: 'Free Slewing',
      renderCell(row) {
        return createElement(MonitoringStatusDot, {
          tone: row.freeSlewing ? 'ok' : 'idle',
        });
      },
    },
    {
      id: 'rotate',
      header: 'Rotate',
      renderCell(row) {
        return createElement(MonitoringStatusDot, {
          tone: row.rotate ? 'ok' : 'idle',
        });
      },
    },
    {
      id: 'trolley1',
      header: 'Trolley #1',
      renderCell(row) {
        return row.trolley1;
      },
    },
    {
      id: 'trolley2',
      header: 'Trolley #2',
      renderCell(row) {
        return row.trolley2;
      },
    },
    {
      id: 'gantry',
      header: 'Gantry',
      renderCell(row) {
        return row.gantry;
      },
    },
    {
      id: 'hoist1',
      header: 'Hoist #1',
      renderCell(row) {
        return row.hoist1;
      },
    },
    {
      id: 'hoist2',
      header: 'Hoist #2',
      renderCell(row) {
        return row.hoist2;
      },
    },
    {
      id: 'hoist3',
      header: 'Hoist #3',
      renderCell(row) {
        return row.hoist3;
      },
    },
    {
      id: 'trolley2Secondary',
      header: 'Trolley #2',
      renderCell(row) {
        return row.trolley2Secondary;
      },
    },
    {
      id: 'slewing',
      header: 'Slewing',
      renderCell(row) {
        return row.slewing;
      },
    },
    {
      id: 'gantrySecondary',
      header: 'Gantry',
      cellClassName: EMPHASIS_CELL_CLASS,
      renderCell(row) {
        return row.gantrySecondary;
      },
    },
  ];

const OPERATION_INFO_COLUMNS: readonly MonitoringStatusColumn<IndoorInfoRow>[] =
  [
    {
      id: 'equipment',
      header: '장비',
      cellClassName: LEFT_EMPHASIS_CELL_CLASS,
      renderCell(row) {
        return row.equipment;
      },
    },
    {
      id: 'equipmentType',
      header: '유형',
      renderCell(row) {
        return row.equipmentType;
      },
    },
    {
      id: 'location',
      header: '위치',
      renderCell(row) {
        return row.location;
      },
    },
    {
      id: 'status',
      header: '상태',
      renderCell(row) {
        return row.status;
      },
    },
    {
      id: 'task',
      header: '작업',
      renderCell(row) {
        return row.task;
      },
    },
    {
      id: 'direction',
      header: '방향',
      cellClassName: EMPHASIS_CELL_CLASS,
      renderCell(row) {
        return row.direction;
      },
    },
  ];

const OPERATION_STATUS_COLUMNS: readonly MonitoringStatusColumn<IndoorStatusRow>[] =
  [
    {
      id: 'time',
      header: '시각',
      renderCell(row) {
        return row.time;
      },
    },
    {
      id: 'equipment',
      header: '장비',
      cellClassName: LEFT_EMPHASIS_CELL_CLASS,
      renderCell(row) {
        return row.equipment;
      },
    },
    {
      id: 'statusChange',
      header: '상태 변화',
      renderCell(row) {
        return row.statusChange;
      },
    },
    {
      id: 'level',
      header: '레벨',
      cellClassName(row) {
        if (row.level === '정상') {
          return undefined;
        }

        return EMPHASIS_CELL_CLASS;
      },
      renderCell(row) {
        return row.level;
      },
    },
    {
      id: 'location',
      header: '위치',
      renderCell(row) {
        return row.location;
      },
    },
  ];

const REALTIME_MONITORING_TABLE = createMonitoringStatusTable<IndoorCraneRow>({
  columns: MONITORING_STATUS_COLUMNS,
  rows: INDOOR_WORK_CRANE_ROWS,
  getRowKey(row) {
    return row.equipment;
  },
});

const OPERATION_INFO_TABLE = createMonitoringStatusTable<IndoorInfoRow>({
  columns: OPERATION_INFO_COLUMNS,
  rows: INDOOR_WORK_OPERATION_INFO_ROWS,
  getRowKey(row) {
    return row.equipment;
  },
});

const OPERATION_STATUS_TABLE = createMonitoringStatusTable<IndoorStatusRow>({
  columns: OPERATION_STATUS_COLUMNS,
  rows: INDOOR_WORK_OPERATION_STATUS_ROWS,
  getRowKey(row) {
    return `${row.time}-${row.equipment}`;
  },
});

export const INDOOR_WORK_BOTTOM_PANEL_TABLE_MAP: Record<
  MonitoringMenuKey,
  MonitoringStatusTableData<unknown>
> = {
  'event-log': REALTIME_MONITORING_TABLE,
  'operation-info': OPERATION_INFO_TABLE,
  'operation-status': OPERATION_STATUS_TABLE,
  playback: REALTIME_MONITORING_TABLE,
  'realtime-monitoring': REALTIME_MONITORING_TABLE,
  'screen-editor': REALTIME_MONITORING_TABLE,
};
