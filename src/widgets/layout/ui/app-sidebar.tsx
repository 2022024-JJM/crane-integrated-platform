import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppNavLink } from '@/shared/ui/atoms/app-link';
import { Separator } from '@/shared/ui/atoms/separator';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import { useSidebar } from '@/shared/lib/sidebar-context';
import { getNavigationConfig } from '../config/navigation';

export function AppSidebar() {
  const { i18n } = useTranslation();
  const { isOpen } = useSidebar();
  const { pathname } = useLocation();
  const navGroups = getNavigationConfig(pathname);
  void i18n.language;

  return (
    <aside
      className={`${
        isOpen ? 'visible' : 'hidden'
      } bg-sidebar h-full min-h-0 w-64 shrink-0 overflow-hidden border-r`}
    >
      <ScrollArea className="h-full">
        <nav className="flex flex-col gap-2 p-4">
          {navGroups.map((group, groupIdx) => (
            <div key={group.title}>
              {groupIdx > 0 && <Separator className="my-2" />}
              <p className="text-muted-foreground mb-1 px-2 text-xs font-medium tracking-wider uppercase">
                {group.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <AppNavLink
                      to={item.path}
                      end={item.path === '/'}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-md px-2 py-2 text-[12px] font-medium transition-colors ${
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </AppNavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
