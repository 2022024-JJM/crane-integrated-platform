import type { Alarm, AlarmStatistics } from "./types"

const allAlarms: Alarm[] = [
  // dock-1 알람
  {
    id: "alarm-001",
    regionId: "dock-1",
    craneId: "crane-107",
    craneName: "GC-107",
    severity: "warning",
    message: "풍속 경고: 12.5m/s 초과",
    timestamp: "2026-03-17T09:31:00",
  },
  {
    id: "alarm-002",
    regionId: "dock-1",
    craneId: "crane-108",
    craneName: "GC-108",
    severity: "warning",
    message: "하중 경고: 최대 하중의 95% 도달",
    timestamp: "2026-03-17T09:30:00",
  },
  {
    id: "alarm-003",
    regionId: "dock-1",
    craneId: "crane-108",
    craneName: "GC-108",
    severity: "warning",
    message: "풍속 경고: 14.0m/s 초과",
    timestamp: "2026-03-17T09:29:00",
  },
  {
    id: "alarm-004",
    regionId: "dock-1",
    craneId: "crane-101",
    craneName: "GC-101",
    severity: "info",
    message: "정기 점검 일정 D-3",
    timestamp: "2026-03-17T09:00:00",
  },
  {
    id: "alarm-005",
    regionId: "dock-1",
    craneId: "crane-103",
    craneName: "GC-103",
    severity: "info",
    message: "대기 모드 전환 완료",
    timestamp: "2026-03-17T09:25:00",
  },
  // dock-2 알람
  {
    id: "alarm-006",
    regionId: "dock-2",
    craneId: "crane-206",
    craneName: "QC-206",
    severity: "critical",
    message: "비상 정지: 안전 장치 작동",
    timestamp: "2026-03-17T09:00:00",
  },
  {
    id: "alarm-007",
    regionId: "dock-2",
    craneId: "crane-205",
    craneName: "QC-205",
    severity: "warning",
    message: "하중 경고: 최대 하중의 90% 도달",
    timestamp: "2026-03-17T09:31:00",
  },
  {
    id: "alarm-008",
    regionId: "dock-2",
    craneId: "crane-205",
    craneName: "QC-205",
    severity: "warning",
    message: "풍속 경고: 11.0m/s 초과",
    timestamp: "2026-03-17T09:28:00",
  },
  {
    id: "alarm-009",
    regionId: "dock-2",
    craneId: "crane-203",
    craneName: "QC-203",
    severity: "info",
    message: "작업 구역 변경 완료",
    timestamp: "2026-03-17T09:15:00",
  },
  // dock-3 알람
  {
    id: "alarm-010",
    regionId: "dock-3",
    craneId: "crane-303",
    craneName: "BC-303",
    severity: "critical",
    message: "풍속 초과로 운행 정지: 15.0m/s",
    timestamp: "2026-03-17T08:45:00",
  },
  {
    id: "alarm-011",
    regionId: "dock-3",
    craneId: "crane-304",
    craneName: "BC-304",
    severity: "critical",
    message: "풍속 초과로 운행 정지: 15.2m/s",
    timestamp: "2026-03-17T08:40:00",
  },
  {
    id: "alarm-012",
    regionId: "dock-3",
    craneId: "crane-301",
    craneName: "BC-301",
    severity: "info",
    message: "작업 재개 완료",
    timestamp: "2026-03-17T09:30:00",
  },
]

export function getAlarmsByRegion(regionId: string): Alarm[] {
  return allAlarms
    .filter((alarm) => alarm.regionId === regionId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function getAlarmStatsByRegion(regionId: string): AlarmStatistics {
  const alarms = allAlarms.filter((alarm) => alarm.regionId === regionId)
  return {
    critical: alarms.filter((a) => a.severity === "critical").length,
    warning: alarms.filter((a) => a.severity === "warning").length,
    info: alarms.filter((a) => a.severity === "info").length,
  }
}
