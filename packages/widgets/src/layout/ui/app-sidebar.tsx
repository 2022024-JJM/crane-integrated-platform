import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppNavLink } from '@crane/ui/atoms/app-link';
import { Separator } from '@crane/ui/atoms/separator';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { useSidebar } from '@crane/core/lib/sidebar-context';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { getNavigationConfig } from '../config/navigation';

export function AppSidebar() {
  const { i18n } = useTranslation();
  const { isOpen } = useSidebar();
  const { siteType } = useSiteType();
  const { pathname } = useLocation();
  const navGroups = getNavigationConfig(pathname, siteType);
  void i18n.language;

  return (
    <aside
      className={`${
        isOpen ? 'visible' : 'hidden'
      } bg-sidebar h-full min-h-0 w-64 shrink-0 overflow-hidden border-r`}
    >
      <ScrollArea className="h-full">
        <nav className="flex flex-col gap-2 p-4">
          {navGroups.filter((group) => group.items.length > 0).map((group, groupIdx) => (
            <div key={group.title}>
              {groupIdx > 0 && <Separator className="my-2" />}
              {group.highlight ? (
                <div className="mb-2 px-2">
                  <p className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">크레인</p>
                  <p className="text-base font-bold tracking-wide text-foreground">{group.title}</p>
                </div>
              ) : (
                <p className="text-muted-foreground mb-1 px-2 text-xs font-medium tracking-wider uppercase">
                  {group.title}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.path}>
                    {item.separatorBefore ? (
                      <Separator className="my-2" />
                    ) : null}
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
