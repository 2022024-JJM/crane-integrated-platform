import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string | number;
  separatorBefore?: boolean;
  /** NavLink 정확일치 매칭 — 다른 항목들의 prefix가 되는 경로(예: /mro2)에 사용 */
  end?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  highlight?: boolean;
}
