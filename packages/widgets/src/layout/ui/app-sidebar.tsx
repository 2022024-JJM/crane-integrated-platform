import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppNavLink } from '@crane/ui/atoms/app-link';
import { SCENE_DOCK_RAIL_COLUMN_WIDTH } from '@crane/ui/organisms/scene-dock';
import { Separator } from '@crane/ui/atoms/separator';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { useAuth } from '@crane/features/auth';
import { cn } from '@crane/core/lib/utils';
import { useSidebar } from '@crane/core/lib/sidebar-context';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { getNavigationConfig } from '../config/navigation';

/**
 * 사이드바는 접힘(rail)/펼침 두 상태다. 접히면 lg 이상에서 아이콘만 남는
 * 좁은 레일이 되고 항목 이름은 hover/focus 툴팁으로 보여 준다. lg 미만은
 * 오버레이 드로어라 레일을 둘 자리가 없어 접힘 = 완전히 숨김이다.
 *
 * 접힌 레일의 폭·항목 박스·간격·구분선은 3D 모니터링 우측 독 레일
 * (`SceneDockRail` 아이콘 열 40px, `icon-sm` 28px 정사각, gap 6px)과 같게
 * 맞춘다 — 같은 화면의 좌우 레일이 다른 폭으로 보이지 않게.
 */
export function AppSidebar() {
  const { t, i18n } = useTranslation('common');
  const { isOpen, close } = useSidebar();
  const { siteType } = useSiteType();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const navGroups = getNavigationConfig(pathname, siteType, user?.role);
  const collapsed = !isOpen;
  // 접힘 시 독 레일의 DockRailSeparator 와 같은 20px 중앙 선. Separator 아톰이
  // data-horizontal:w-full 을 쓰므로 같은 variant 로 덮어야 tailwind-merge 가 이긴다.
  const separatorClassName = collapsed
    ? 'my-0.5 bg-black/25 data-horizontal:w-5 dark:bg-white/25'
    : 'my-2';
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
        className={cn(
          'bg-sidebar h-full min-h-0 shrink-0 overflow-hidden border-r max-lg:fixed max-lg:top-14 max-lg:bottom-0 max-lg:left-0 max-lg:z-50 max-lg:h-auto max-lg:shadow-xl',
          collapsed ? 'max-lg:hidden' : 'w-64',
        )}
        style={collapsed ? { width: SCENE_DOCK_RAIL_COLUMN_WIDTH } : undefined}
      >
        <ScrollArea className="h-full">
          <TooltipProvider delay={150}>
            <nav
              className={cn(
                'flex flex-col',
                collapsed ? 'items-center gap-1.5 px-0 py-1.5' : 'gap-2 p-4',
              )}
            >
              {navGroups
                .filter((group) => group.items.length > 0)
                .map((group, groupIdx) => (
                  <div
                    key={group.title}
                    className={cn(
                      collapsed && 'flex flex-col items-center gap-1.5',
                    )}
                  >
                    {groupIdx > 0 && (
                      <Separator className={separatorClassName} />
                    )}
                    {collapsed ? null : group.highlight ? (
                      <div className="mb-2 px-2">
                        <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                          {t('nav.categoryCrane')}
                        </p>
                        <p className="text-foreground text-base font-bold tracking-wide">
                          {group.title}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground mb-1 px-2 text-xs font-medium tracking-wider uppercase">
                        {group.title}
                      </p>
                    )}
                    <ul
                      className={cn(
                        'flex flex-col',
                        collapsed ? 'items-center gap-1.5' : 'gap-0.5',
                      )}
                    >
                      {group.items.map((item) => {
                        const link = (
                          <AppNavLink
                            to={item.path}
                            end={item.path === '/' || item.end === true}
                            aria-label={collapsed ? item.label : undefined}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center text-[12px] font-medium transition-colors',
                                collapsed
                                  ? 'size-7 justify-center rounded-[min(var(--radius-md),12px)] p-0'
                                  : 'gap-3 rounded-md px-2 py-2',
                                isActive
                                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                              )
                            }
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            {collapsed ? null : (
                              <span className="truncate">{item.label}</span>
                            )}
                          </AppNavLink>
                        );

                        return (
                          <li
                            key={item.path}
                            className={cn(
                              collapsed && 'flex flex-col items-center gap-1.5',
                            )}
                          >
                            {item.separatorBefore ? (
                              <Separator className={separatorClassName} />
                            ) : null}
                            {collapsed ? (
                              <Tooltip>
                                <TooltipTrigger
                                  render={<span className="block" />}
                                >
                                  {link}
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={8}>
                                  {item.label}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              link
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
            </nav>
          </TooltipProvider>
        </ScrollArea>
      </aside>
    </>
  );
}
