export type StatusLevel = "normal" | "warning" | "critical"

export interface StatusSummary {
  normal: number
  warning: number
  critical: number
}

export interface Region {
  id: string
  status: StatusLevel
  statusSummary: StatusSummary
  navigateTo: string
}
