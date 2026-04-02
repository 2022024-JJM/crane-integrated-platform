import type { StatusLevel } from '@/shared/types/status';

export type { StatusLevel } from '@/shared/types/status';

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
