import type { AlarmSeverity } from './types';

export interface AlarmMetadata {
  alarmName: string;
  description: string;
  severity: AlarmSeverity;
}

const alarmMetadataByCode: Record<string, AlarmMetadata> = {
  crane_control_on: {
    alarmName: 'Crane Control On',
    description: '크레인 제어 상태 ON',
    severity: 'info',
  },
  crane_system_error: {
    alarmName: 'Crane System Error',
    description: '크레인 시스템 에러',
    severity: 'high',
  },
  crane_inverter_error: {
    alarmName: 'Crane Inverter Error',
    description: '크레인 인버터 에러',
    severity: 'high',
  },
  accs_bypass_on: {
    alarmName: 'ACCS Bypass On',
    description: '충돌 방지 바이패스 ON',
    severity: 'medium',
  },
  accs_off: {
    alarmName: 'ACCS Off',
    description: '충돌 방지 모드 OFF',
    severity: 'medium',
  },
  e_stop_on: {
    alarmName: 'E Stop On',
    description: '비상정지 ON',
    severity: 'critical',
  },
  remote_control_on_ack: {
    alarmName: 'Remote Control On Ack',
    description: '원격 제어 ON 응답',
    severity: 'info',
  },
};

export function getAlarmMetadata(alarmCode: string) {
  return alarmMetadataByCode[alarmCode];
}
