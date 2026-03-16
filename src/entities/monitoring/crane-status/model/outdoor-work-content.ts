import { createElement } from 'react';

import { MonitoringStatusDot } from '../lib/cell-renderers';
import {
  createMonitoringStatusTable,
  type MonitoringStatusColumn,
} from './types';
import type {
  OutdoorCraneRow,
  OutdoorInfoRow,
  OutdoorStatusRow,
} from './outdoor-work-types';

export const OUTDOOR_WORK_CRANE_ROWS = [
  {
    equipment: 'GC-4',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '74.3',
    trolley2: '',
    gantry: '71.3',
    hoist1: '67.8',
    hoist2: '118.4',
    hoist3: '',
    trolley2Secondary: '',
    slewing: '239',
    gantrySecondary: '24.4',
  },
  {
    equipment: 'TTC-26',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '',
    trolley2: '85',
    gantry: '52',
    hoist1: '',
    hoist2: '',
    hoist3: '85',
    trolley2Secondary: '',
    slewing: '696.6',
    gantrySecondary: '6.6',
  },
  {
    equipment: 'TTC-20',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '',
    trolley2: '89',
    gantry: '49',
    hoist1: '',
    hoist2: '',
    hoist3: '89',
    trolley2Secondary: '',
    slewing: '604.8',
    gantrySecondary: '0',
  },
  {
    equipment: 'TTC-13',
    comm: true,
    on: true,
    fault: true,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '',
    trolley2: '75.5',
    gantry: '62',
    hoist1: '',
    hoist2: '16.8',
    hoist3: '',
    trolley2Secondary: '',
    slewing: '635.7',
    gantrySecondary: '-0.6',
  },
  {
    equipment: 'TTC-5',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '',
    trolley2: '90.8',
    gantry: '61',
    hoist1: '',
    hoist2: '34.1',
    hoist3: '',
    trolley2Secondary: '',
    slewing: '307.7',
    gantrySecondary: '-0.1',
  },
  {
    equipment: 'TTC-12',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '',
    trolley2: '265.6',
    gantry: '55',
    hoist1: '',
    hoist2: '85.3',
    hoist3: '',
    trolley2Secondary: '',
    slewing: '806.6',
    gantrySecondary: '0',
  },
  {
    equipment: 'TTC-30',
    comm: true,
    on: true,
    fault: false,
    notComm: false,
    freeSlewing: false,
    rotate: false,
    trolley1: '',
    trolley2: '352.9',
    gantry: '39.1',
    hoist1: '',
    hoist2: '53.2',
    hoist3: '',
    trolley2Secondary: '',
    slewing: '528.1',
    gantrySecondary: '0',
  },
] satisfies readonly OutdoorCraneRow[];

export const OUTDOOR_WORK_OPERATION_INFO_ROWS = [
  {
    equipment: 'GC-4',
    equipmentType: 'Gantry Crane',
    location: 'Berth A-03',
    status: '정상',
    task: '컨테이너 양하',
    direction: '정면',
  },
  {
    equipment: 'TTC-26',
    equipmentType: 'Transfer Crane',
    location: 'Yard B-12',
    status: '정상',
    task: '블록 적재',
    direction: '북동',
  },
  {
    equipment: 'TTC-20',
    equipmentType: 'Transfer Crane',
    location: 'Yard B-07',
    status: '점검',
    task: '대기',
    direction: '서측',
  },
  {
    equipment: 'TC-57',
    equipmentType: 'Trolley Crane',
    location: 'Berth A-05',
    status: '주의',
    task: '선적 대기',
    direction: '남동',
  },
] satisfies readonly OutdoorInfoRow[];

export const OUTDOOR_WORK_OPERATION_STATUS_ROWS = [
  {
    time: '09:10',
    equipment: 'GC-4',
    statusChange: '호이스트 상승',
    level: '정상',
    location: '상단 프레임',
  },
  {
    time: '09:12',
    equipment: 'TTC-26',
    statusChange: '트롤리 이동',
    level: '정상',
    location: '야드 라인 3',
  },
  {
    time: '09:14',
    equipment: 'TC-57',
    statusChange: '회전 속도 편차',
    level: '주의',
    location: '버스 바 인근',
  },
  {
    time: '09:18',
    equipment: 'TTC-20',
    statusChange: '점검 모드 전환',
    level: '점검',
    location: '블록 B-07',
  },
  {
    time: '09:20',
    equipment: 'GC-4',
    statusChange: '컨테이너 인계 완료',
    level: '정상',
    location: '선석 A-03',
  },
] satisfies readonly OutdoorStatusRow[];

const EMPHASIS_CELL_CLASS =
  'font-bold text-[var(--outdoor-page-table-emphasis)]';

const LEFT_EMPHASIS_CELL_CLASS =
  'text-left font-bold text-[var(--outdoor-page-table-emphasis)]';

const MONITORING_STATUS_COLUMNS: readonly MonitoringStatusColumn<OutdoorCraneRow>[] =
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

const OPERATION_INFO_COLUMNS: readonly MonitoringStatusColumn<OutdoorInfoRow>[] =
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

const OPERATION_STATUS_COLUMNS: readonly MonitoringStatusColumn<OutdoorStatusRow>[] =
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

export const OUTDOOR_REALTIME_MONITORING_TABLE =
  createMonitoringStatusTable<OutdoorCraneRow>({
    columns: MONITORING_STATUS_COLUMNS,
    rows: OUTDOOR_WORK_CRANE_ROWS,
    getRowKey(row) {
      return row.equipment;
    },
  });

export const OUTDOOR_OPERATION_INFO_TABLE =
  createMonitoringStatusTable<OutdoorInfoRow>({
    columns: OPERATION_INFO_COLUMNS,
    rows: OUTDOOR_WORK_OPERATION_INFO_ROWS,
    getRowKey(row) {
      return row.equipment;
    },
  });

export const OUTDOOR_OPERATION_STATUS_TABLE =
  createMonitoringStatusTable<OutdoorStatusRow>({
    columns: OPERATION_STATUS_COLUMNS,
    rows: OUTDOOR_WORK_OPERATION_STATUS_ROWS,
    getRowKey(row) {
      return `${row.time}-${row.equipment}`;
    },
  });
