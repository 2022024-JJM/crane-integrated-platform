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
  /**
   * 헤더 가로 메뉴(`usesHeaderNav`)에서 항목 아래로 펴는 갈래 — 같은 화면을 쿼리로 나눈다
   * (예: `?view=performance`). 사이드바는 그리지 않는다.
   */
  children?: NavSubItem[];
}

export interface NavSubItem {
  label: string;
  /** 쿼리까지 포함한 경로 */
  path: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  highlight?: boolean;
}
