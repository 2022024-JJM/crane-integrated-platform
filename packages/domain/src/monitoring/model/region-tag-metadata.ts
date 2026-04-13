import type { MonitoringTagDefinition } from './types';

export interface MonitoringTagMetadataOverride {
  displayName?: string;
  dataType?: string | null;
  unit?: string | null;
  description?: string | null;
}

export type MonitoringLiveTableColumn = MonitoringTagDefinition & {
  description?: string | null;
};

type MonitoringTagMetadataOverrideById = Partial<
  Record<number, MonitoringTagMetadataOverride>
>;

const MONITORING_TAG_METADATA_OVERRIDES_BY_REGION: Record<
  string,
  MonitoringTagMetadataOverrideById
> = {
  'dock-in': {
    1: { displayName: 'Year', dataType: 'INT', description: '연도' },
    2: { displayName: 'Month', dataType: 'INT', description: '월' },
    3: { displayName: 'Day', dataType: 'INT', description: '일' },
    4: { displayName: 'Hour', dataType: 'INT', description: '시' },
    5: { displayName: 'Minute', dataType: 'INT', description: '분' },
    6: { displayName: 'Second', dataType: 'INT', description: '초' },
    7: {
      displayName: 'MH#1 무게 값',
      dataType: 'INT',
      unit: 'ton',
      description: '로드셀 무게 값 표시',
    },
    8: {
      displayName: 'MH#2 무게 값',
      dataType: 'INT',
      unit: 'ton',
      description: '로드셀 무게 값 표시',
    },
    9: {
      displayName: 'MH#3 무게 값',
      dataType: 'INT',
      unit: 'ton',
      description: '로드셀 무게 값 표시',
    },
    10: {
      displayName: 'AH#1 무게 값',
      dataType: 'INT',
      unit: 'ton',
      description: '로드셀 무게 값 표시',
    },
    11: {
      displayName: 'AH#2 무게 값',
      dataType: 'INT',
      unit: 'ton',
      description: '로드셀 무게 값 표시',
    },
    12: {
      displayName: 'MH#1 높이 값',
      dataType: 'INT',
      unit: 'm',
      description: '바닥에서 후크까지의 높이 값',
    },
    13: {
      displayName: 'MH#2 높이 값',
      dataType: 'INT',
      unit: 'm',
      description: '바닥에서 후크까지의 높이 값',
    },
    14: {
      displayName: 'MH#3 높이 값',
      dataType: 'INT',
      unit: 'm',
      description: '바닥에서 후크까지의 높이 값',
    },
    15: {
      displayName: 'AH#1 높이 값',
      dataType: 'INT',
      unit: 'm',
      description: '바닥에서 후크까지의 높이 값',
    },
    16: {
      displayName: 'AH#2 높이 값',
      dataType: 'INT',
      unit: 'm',
      description: '바닥에서 후크까지의 높이 값',
    },
    17: {
      displayName: 'TS#1 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: '반사판에서 횡행까지의 거리 값',
    },
    18: {
      displayName: 'TS#2 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: '반사판에서 횡행까지의 거리 값',
    },
    19: {
      displayName: 'TS#3 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: '반사판에서 횡행까지의 거리 값',
    },
    20: {
      displayName: 'TL 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: '주행 거리 값',
    },
    21: {
      displayName: 'TS 정지 기어 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: 'TS 정지 기어 거리 값',
    },
    22: {
      displayName: 'TS 1단 기어 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: 'TS 1단 기어 거리 값',
    },
    23: {
      displayName: 'TS 2단 기어 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: 'TS 2단 기어 거리 값',
    },
    24: {
      displayName: 'TS 3단 기어 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: 'TS 3단 기어 거리 값',
    },
    25: {
      displayName: 'TL 정지 기어 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: 'TL 정지 기어 거리 값',
    },
    26: {
      displayName: 'TL 1단 기어 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: 'TL 1단 기어 거리 값',
    },
    27: {
      displayName: 'TL 2단 기어 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: 'TL 2단 기어 거리 값',
    },
    28: {
      displayName: 'TL 3단 기어 거리 값',
      dataType: 'INT',
      unit: 'm',
      description: 'TL 3단 기어 거리 값',
    },
    29: {
      displayName: 'Heartbeat',
      dataType: 'BIT0',
      description: 'Heartbeat',
    },
    30: {
      displayName: 'Crane Control On',
      dataType: 'BIT1',
      description: '크레인 제어 상태 ON',
    },
    31: {
      displayName: 'Crane System Error',
      dataType: 'BIT2',
      description: '크레인 시스템 에러',
    },
    32: {
      displayName: 'Crane Inverter Error',
      dataType: 'BIT3',
      description: '크레인 인버터 에러',
    },
    33: {
      displayName: 'ACCS Bypass On',
      dataType: 'BIT4',
      description: '충돌 방지 바이패스 ON',
    },
    34: {
      displayName: 'ACCS Off',
      dataType: 'BIT5',
      description: '충돌 방지 모드 OFF',
    },
    35: {
      displayName: 'E Stop On',
      dataType: 'BIT6',
      description: '비상정지 ON',
    },
    36: {
      displayName: '원격 제어 On Ack',
      dataType: 'BIT7',
      description: '원격 제어 ON 응답',
    },
    45: {
      displayName: 'MH#1 Status',
      dataType: 'BIT0',
      description: '주권#1 상태 정상',
    },
    46: {
      displayName: 'MH#2 Status',
      dataType: 'BIT1',
      description: '주권#2 상태 정상',
    },
    47: {
      displayName: 'MH#3 Status',
      dataType: 'BIT2',
      description: '주권#3 상태 정상',
    },
    48: {
      displayName: 'AH#1 Status',
      dataType: 'BIT3',
      description: '보권#1 상태 정상',
    },
    49: {
      displayName: 'AH#2 Status',
      dataType: 'BIT4',
      description: '보권#2 상태 정상',
    },
    50: {
      displayName: 'TS#1 Status',
      dataType: 'BIT5',
      description: '횡행#1 상태 정상',
    },
    51: {
      displayName: 'TS#2 Status',
      dataType: 'BIT6',
      description: '횡행#2 상태 정상',
    },
    52: {
      displayName: 'TS#3 Status',
      dataType: 'BIT7',
      description: '횡행#3 상태 정상',
    },
    53: {
      displayName: 'TL Status',
      dataType: 'BIT0',
      description: '주행 상태 정상',
    },
  },
};

export function getMonitoringTagMetadataOverridesByRegion(regionId: string) {
  return MONITORING_TAG_METADATA_OVERRIDES_BY_REGION[regionId] ?? {};
}
