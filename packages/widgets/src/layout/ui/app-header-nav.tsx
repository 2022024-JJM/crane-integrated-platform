import { Fragment } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDownIcon } from 'lucide-react';
import type { NavItem } from '@crane/core/types/navigation';
import { cn } from '@crane/core/lib/utils';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { AppLink, AppNavLink } from '@crane/ui/atoms/app-link';
import { useAuth } from '@crane/features/auth';
import { getNavigationConfig } from '../config/navigation';
import { activeSubItem, needsExactMatch } from '../lib/header-nav';

/**
 * 헤더의 가로 메뉴 — 사이드바 항목을 헤더 한 줄에 펼친다(`usesHeaderNav` 계정만).
 *
 * 항목은 사이드바와 같은 설정(`getNavigationConfig`)에서 온다. 묶음은 이름 대신 세로
 * 헤어라인으로 가른다 — 한 줄에 묶음 이름까지 적으면 메뉴가 두 겹으로 읽힌다.
 * 갈래(`children`)가 있는 항목은 마우스를 올리거나 키보드 초점이 들어가면 아래로
 * 드롭다운을 편다. 항목 자체를 누르면 기본 갈래로 간다.
 */
export function AppHeaderNav({ className }: { className?: string }) {
  const { siteType } = useSiteType();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const groups = getNavigationConfig(pathname, siteType, user?.role)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.viewport !== 'mobile'),
    }))
    .filter((group) => group.items.length > 0);
  const allItems = groups.flatMap((group) => group.items);

  return (
    <nav className={cn('min-w-0 items-center', className)}>
      {groups.map((group, groupIndex) => (
        <Fragment key={group.title}>
          {groupIndex > 0 && (
            <span
              aria-hidden="true"
              className="bg-border mx-1 h-5 w-px shrink-0 xl:mx-1.5"
            />
          )}
          <div
            role="group"
            aria-label={group.title}
            className="flex items-center gap-0.5"
          >
            {group.items.map((item) => (
              <HeaderNavItem
                key={item.path}
                item={item}
                end={needsExactMatch(item, allItems)}
              />
            ))}
          </div>
        </Fragment>
      ))}
    </nav>
  );
}

function HeaderNavItem({ item, end }: { item: NavItem; end: boolean }) {
  const children = item.children ?? [];
  const link = (
    <AppNavLink
      to={item.path}
      end={end}
      className={({ isActive }) =>
        cn(
          // md~xl(확대 포함)에서는 한 줄에 들어가도록 좁힌다
          'inline-flex h-8 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium whitespace-nowrap transition-colors xl:px-2.5 xl:text-[13px]',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
        )
      }
    >
      {item.label}
      {children.length > 0 && (
        <ChevronDownIcon className="size-3 opacity-60" aria-hidden="true" />
      )}
    </AppNavLink>
  );
  if (children.length === 0) return link;

  return (
    <div className="group/nav relative">
      {link}
      <HeaderNavMenu item={item} />
    </div>
  );
}

/** 항목 아래 드롭다운 — 같은 화면의 갈래를 고른다. 지금 보는 갈래에 강조를 둔다 */
function HeaderNavMenu({ item }: { item: NavItem }) {
  const { pathname, search } = useLocation();
  const children = item.children ?? [];
  const current = activeSubItem(children, pathname, search);

  return (
    <div
      className={cn(
        'invisible absolute top-full left-0 z-50 pt-1 opacity-0 transition-opacity duration-100',
        'group-hover/nav:visible group-hover/nav:opacity-100',
        // 키보드 초점일 때만 연다 — 마우스로 누르면 초점이 남아 손을 떼도 안 닫힌다
        'group-has-[:focus-visible]/nav:visible group-has-[:focus-visible]/nav:opacity-100',
      )}
    >
      <ul
        aria-label={item.label}
        className="bg-popover text-popover-foreground min-w-full rounded-lg border p-1 shadow-md"
      >
        {children.map((child) => (
          <li key={child.path}>
            <AppLink
              to={child.path}
              // 고른 뒤 초점을 놓아 드롭다운이 바로 접히게 한다
              onClick={(event) => event.currentTarget.blur()}
              aria-current={current === child ? 'page' : undefined}
              className={cn(
                'flex h-8 items-center rounded-md px-3 text-[13px] font-medium whitespace-nowrap',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                current === child
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              {child.label}
            </AppLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
