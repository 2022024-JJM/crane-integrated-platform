import { Menu } from 'lucide-react';

import { INDOOR_WORK_MENU_ITEMS } from '@/pages/indoor-work/config/indoor-work-content';
import type { IndoorMenuKey } from '@/pages/indoor-work/model/types';
import { cn } from '@/shared/lib/utils';

interface IndoorWorkSidebarProps {
  activeMenu: IndoorMenuKey;
  isCollapsed: boolean;
  sidebarTitle: string;
  onSelectMenu: (menu: IndoorMenuKey) => void;
  onToggleCollapse: () => void;
}

export function IndoorWorkSidebar({
  activeMenu,
  isCollapsed,
  sidebarTitle,
  onSelectMenu,
  onToggleCollapse,
}: IndoorWorkSidebarProps) {
  return (
    <aside
      className={cn(
        'flex flex-col border-r border-r-[var(--outdoor-page-panel-border)]',
        isCollapsed &&
          '[&_.sidebar-head]:justify-center [&_.sidebar-item]:justify-center [&_.sidebar-item]:px-0 [&_.sidebar-item_span]:hidden [&_.sidebar-title]:pointer-events-none [&_.sidebar-title]:-translate-x-1.5 [&_.sidebar-title]:opacity-0',
      )}
    >
      <div className="sidebar-head flex h-[46px] items-center gap-2 border-b border-b-[var(--outdoor-page-panel-border)] px-2.5">
        <button
          className="grid h-6 w-6 place-items-center rounded-md bg-[var(--outdoor-page-sidebar-button-bg)] text-[var(--outdoor-page-sidebar-button-text)]"
          type="button"
          aria-label={isCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
          aria-expanded={!isCollapsed}
          onClick={onToggleCollapse}
        >
          <Menu size={16} />
        </button>
        <div className="sidebar-title text-[18px] font-bold tracking-[0.03em] text-[var(--outdoor-page-accent-strong)] transition-all">
          {sidebarTitle}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-auto p-2">
        <ul className="flex flex-col gap-1.5">
          {INDOOR_WORK_MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeMenu;

            return (
              <li key={item.key}>
                <button
                  type="button"
                  className={cn(
                    'sidebar-item flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-[11px] text-left text-[13px] text-[var(--outdoor-page-sidebar-item-text)] transition-all',
                    isActive &&
                      'border-[var(--outdoor-page-accent-active-border)] bg-[linear-gradient(90deg,var(--outdoor-page-accent-active-bg-start),var(--outdoor-page-accent-active-bg-end))] text-[var(--outdoor-page-accent)] shadow-[inset_3px_0_0_var(--outdoor-page-accent-active-shadow)]',
                  )}
                  title={item.label}
                  onClick={() => onSelectMenu(item.key)}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
