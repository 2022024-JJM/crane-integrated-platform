import type { LucideIcon } from "lucide-react"

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  badge?: string | number
}

export interface NavGroup {
  title: string
  items: NavItem[]
}
