import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppNavLink } from '@crane/ui/atoms/app-link';
import { Separator } from '@crane/ui/atoms/separator';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { useAuth } from '@crane/features/auth';
import { useSidebar } from '@crane/core/lib/sidebar-context';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { getNavigationConfig } from '../config/navigation';

export function AppSidebar() {
  const { t, i18n } = useTranslation('common');
  const { isOpen, close } = useSidebar();
  const { siteType } = useSiteType();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const navGroups = getNavigationConfig(pathname, siteType, user?.role);
  void i18n.language;

  return (
    <>
      {/* lg 미만 드로어 백드롭 — 헤더(h-14)는 클릭 가능하게 남긴다 */}
      {isOpen && (
        <div
          className="fixed inset-0 top-14 z-40 bg-black/40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      {/* lg 미만에서는 본문을 밀지 않는 오버레이 드로어, lg 이상은 기존 인라인 push 유지 */}
      <aside
        className={`${
          isOpen ? 'visible' : 'hidden'
        } bg-sidebar h-full min-h-0 w-64 shrink-0 overflow-hidden border-r max-lg:fixed max-lg:top-14 max-lg:bottom-0 max-lg:left-0 max-lg:z-50 max-lg:h-auto max-lg:shadow-xl`}
      >
        <ScrollArea className="h-full">
          <nav className="flex flex-col gap-2 p-4">
            {navGroups.filter((group) => group.items.length > 0).map((group, groupIdx) => (
              <div key={group.title}>
                {groupIdx > 0 && <Separator className="my-2" />}
                {group.highlight ? (
                  <div className="mb-2 px-2">
                    <p className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">{t('nav.categoryCrane')}</p>
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
    </>
  );
}
