export type StatusLevel = "normal" | "warning" | "critical"

export interface RegionLink {
  label: string
  path: string
}

export interface StatusSummary {
  normal: number
  warning: number
  critical: number
}

export interface Region {
  id: string
  title: string
  subtitle: string
  status: StatusLevel
  links: RegionLink[]
  statusSummary: StatusSummary
  navigateTo: string
}
