export type AlarmSeverity = "critical" | "warning" | "info"

export interface Alarm {
  id: string
  regionId: string
  craneId: string
  craneName: string
  severity: AlarmSeverity
  message: string
  timestamp: string
}

export interface AlarmStatistics {
  critical: number
  warning: number
  info: number
}
