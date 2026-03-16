import { LayoutDashboard, Map, MapPin } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/shared/ui/organisms/sidebar';
import { cn } from '@/shared/lib/utils';

const MAIN_PAGE_MENU_ITEMS = [
  {
    icon: LayoutDashboard,
    label: '대시보드',
    to: '/',
  },
  {
    icon: MapPin,
    label: '지역 선택',
    to: '/region-overview',
  },
] as const;

export function MainPageSidebar() {
  const { open } = useSidebar();
  const { pathname } = useLocation();

  return (
    <aside
      className={cn(
        'hidden min-h-0 shrink-0 overflow-hidden transition-[width] duration-200 ease-linear md:block',
        open ? 'w-[16rem]' : 'w-0',
      )}
    >
      <div
        className={cn(
          'flex h-full w-[16rem] flex-col border-r border-r-[var(--main-page-border)] bg-[linear-gradient(180deg,var(--main-page-surface),var(--main-page-card))] transition-opacity duration-150',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <SidebarContent className="min-h-0 p-3">
          <SidebarMenu className="gap-2">
            {MAIN_PAGE_MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.to;

              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    className="h-auto rounded-lg border border-transparent px-3 py-3 text-left text-[13px] text-[var(--main-page-text)] data-[active=true]:border-[var(--main-page-chip-hover-border)] data-[active=true]:bg-[var(--main-page-chip-hover-bg)] data-[active=true]:text-[var(--main-page-title)] data-[active=true]:shadow-[inset_3px_0_0_var(--main-page-accent)]"
                  >
                    <NavLink to={item.to} end={item.to === '/'}>
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
      </div>
    </aside>
  );
}
