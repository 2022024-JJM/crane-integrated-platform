import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/shared/ui/organisms/sidebar';
import type { MonitoringMenuItem, MonitoringMenuKey } from '../model/types';

interface Props {
  title: string;
  menuItems: MonitoringMenuItem[];
  activeMenu: MonitoringMenuKey;
  onSelectMenu: (menu: MonitoringMenuKey) => void;
}

export function MonitoringMenu({
  title,
  menuItems,
  activeMenu,
  onSelectMenu,
}: Props) {
  return (
    <Sidebar
      collapsible="offcanvas"
      className="[&>[data-slot=sidebar-inner]]:border-r [&>[data-slot=sidebar-inner]]:border-r-[var(--outdoor-page-panel-border)] [&>[data-slot=sidebar-inner]]:bg-[linear-gradient(180deg,var(--outdoor-page-panel-surface-from),var(--outdoor-page-panel-surface-to))]"
    >
      <SidebarHeader className="h-[46px] flex-row items-center gap-2 border-b border-b-[var(--outdoor-page-panel-border)] px-2.5 py-0">
        <SidebarTrigger />
        <div className="text-[18px] font-bold tracking-[0.03em] text-[var(--outdoor-page-accent-strong)] transition-all group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:-translate-x-1.5 group-data-[collapsible=icon]:opacity-0">
          {title}
        </div>
      </SidebarHeader>

      <SidebarContent className="min-h-0 p-2">
        <SidebarMenu className="gap-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <SidebarMenuItem key={item.key}>
                <SidebarMenuButton
                  type="button"
                  isActive={item.key === activeMenu}
                  tooltip={item.label}
                  className="h-auto rounded-lg border border-transparent px-2.5 py-[11px] text-left text-[13px] text-[var(--outdoor-page-sidebar-item-text)] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 data-[active=true]:border-[var(--outdoor-page-accent-active-border)] data-[active=true]:bg-[linear-gradient(90deg,var(--outdoor-page-accent-active-bg-start),var(--outdoor-page-accent-active-bg-end))] data-[active=true]:text-[var(--outdoor-page-accent)] data-[active=true]:shadow-[inset_3px_0_0_var(--outdoor-page-accent-active-shadow)]"
                  onClick={() => onSelectMenu(item.key)}
                >
                  <Icon size={14} />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {item.label}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
