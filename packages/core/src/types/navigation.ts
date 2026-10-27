import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string | number;
  separatorBefore?: boolean;
  /** NavLink 정확일치 매칭 — 다른 항목들의 prefix가 되는 경로(예: /mro2)에 사용 */
  end?: boolean;
  /**
   * 보이는 화면 폭. 없으면 어디서나. 'mobile' 은 휴대폰 폭에서만, 'desktop' 은
   * 그 이상에서만 — 눌러도 리다이렉트로 못 가는 메뉴를 보여 주지 않기 위한 것.
   */
  viewport?: 'mobile' | 'desktop';
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  highlight?: boolean;
}
