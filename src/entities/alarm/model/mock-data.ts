import type { Alarm, AlarmStatistics } from './types';

const allAlarms: Alarm[] = [
  // dock-1 알람
  {
    id: 'alarm-001',
    regionId: 'dock-1',
    craneId: 'crane-107',
    craneName: 'GC-107',
    severity: 'warning',
    eventType: 'wind_warning_exceeded',
    eventData: { value: 12.5 },
    timestamp: '2026-03-17T09:31:00',
  },
  {
    id: 'alarm-002',
    regionId: 'dock-1',
    craneId: 'crane-108',
    craneName: 'GC-108',
    severity: 'warning',
    eventType: 'load_warning_reached',
    eventData: { value: 95 },
    timestamp: '2026-03-17T09:30:00',
  },
  {
    id: 'alarm-003',
    regionId: 'dock-1',
    craneId: 'crane-108',
    craneName: 'GC-108',
    severity: 'warning',
    eventType: 'wind_warning_exceeded',
    eventData: { value: 14.0 },
    timestamp: '2026-03-17T09:29:00',
  },
  {
    id: 'alarm-004',
    regionId: 'dock-1',
    craneId: 'crane-101',
    craneName: 'GC-101',
    severity: 'info',
    eventType: 'maintenance_due',
    eventData: { days: 3 },
    timestamp: '2026-03-17T09:00:00',
  },
  {
    id: 'alarm-005',
    regionId: 'dock-1',
    craneId: 'crane-103',
    craneName: 'GC-103',
    severity: 'info',
    eventType: 'idle_mode_completed',
    timestamp: '2026-03-17T09:25:00',
  },
  // dock-2 알람
  {
    id: 'alarm-006',
    regionId: 'dock-2',
    craneId: 'crane-206',
    craneName: 'QC-206',
    severity: 'critical',
    eventType: 'emergency_stop_triggered',
    timestamp: '2026-03-17T09:00:00',
  },
  {
    id: 'alarm-007',
    regionId: 'dock-2',
    craneId: 'crane-205',
    craneName: 'QC-205',
    severity: 'warning',
    eventType: 'load_warning_reached',
    eventData: { value: 90 },
    timestamp: '2026-03-17T09:31:00',
  },
  {
    id: 'alarm-008',
    regionId: 'dock-2',
    craneId: 'crane-205',
    craneName: 'QC-205',
    severity: 'warning',
    eventType: 'wind_warning_exceeded',
    eventData: { value: 11.0 },
    timestamp: '2026-03-17T09:28:00',
  },
  {
    id: 'alarm-009',
    regionId: 'dock-2',
    craneId: 'crane-203',
    craneName: 'QC-203',
    severity: 'info',
    eventType: 'work_area_changed',
    timestamp: '2026-03-17T09:15:00',
  },
  // 내업 알람
  {
    id: 'alarm-010',
    regionId: 'dock-in',
    craneId: 'crane-303',
    craneName: 'BC-303',
    severity: 'critical',
    eventType: 'wind_stop_exceeded',
    eventData: { value: 15.0 },
    timestamp: '2026-03-17T08:45:00',
  },
  {
    id: 'alarm-011',
    regionId: 'dock-in',
    craneId: 'crane-304',
    craneName: 'BC-304',
    severity: 'critical',
    eventType: 'wind_stop_exceeded',
    eventData: { value: 15.2 },
    timestamp: '2026-03-17T08:40:00',
  },
  {
    id: 'alarm-012',
    regionId: 'dock-in',
    craneId: 'crane-301',
    craneName: 'BC-301',
    severity: 'info',
    eventType: 'work_resumed',
    timestamp: '2026-03-17T09:30:00',
  },
];

export function getAlarmsByRegion(regionId: string): Alarm[] {
  return allAlarms
    .filter((alarm) => alarm.regionId === regionId)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}

export function getAlarmStatsByRegion(regionId: string): AlarmStatistics {
  const alarms = allAlarms.filter((alarm) => alarm.regionId === regionId);
  return {
    critical: alarms.filter((a) => a.severity === 'critical').length,
    warning: alarms.filter((a) => a.severity === 'warning').length,
    info: alarms.filter((a) => a.severity === 'info').length,
  };
}
