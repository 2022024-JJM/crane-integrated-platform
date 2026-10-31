import { MenuIcon } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { useTranslation } from 'react-i18next';
import { PageSettings } from '@crane/features/page-settings';
import { useSidebar } from '@crane/core/lib/sidebar-context';
import { useAuth } from '@crane/features/auth';
import { AppLink } from '@crane/ui/atoms/app-link';
import { HanwhaIcon } from '@crane/ui/atoms/hanwha-icon';
import { SCENE_DOCK_RAIL_COLUMN_WIDTH } from '@crane/ui/organisms/scene-dock';
import { HeaderAlarmButton } from '@crane/features/alarm';
import { HeaderStatusStrip } from './header-status-strip';
import { AppHeaderNav } from './app-header-nav';
import { usesHeaderNav } from '../lib/header-nav';
import { getHeaderBrandKeys } from '../lib/header-brand';
import { getAppEnvBadge } from '../lib/app-env-badge';

const APP_ENV_BADGE = getAppEnvBadge(import.meta.env.VITE_APP_ENV);

export function AppHeader() {
  const { t } = useTranslation();
  const { toggle } = useSidebar();
  const { user } = useAuth();
  const brand = getHeaderBrandKeys(user?.role);
  // 사이드바 대신 헤더 가로 메뉴를 쓰는 계정 — 메뉴가 서는 폭(md)부터 햄버거가 필요 없다.
  // 브라우저를 확대해 폭이 줄어도 md 이상이면 메뉴를 유지한다
  const headerNav = usesHeaderNav(user?.role);

  return (
    // 아래 선은 border-b 대신 inset 그림자다. border 가 가운데 맞춤 높이를
    // 55px 로 줄이면 32px pill 이 0.5px 위치에 놓이는데, 테두리는 픽셀에 맞춰
    // 그려지고 글자는 그렇지 않아 pill 안에서 1px 가까이 떠 보인다.
    <header
      className={cn(
        'bg-background sticky top-0 z-40 flex h-14 shrink-0 items-center gap-1.5 pr-4 pl-0 shadow-[inset_0_-1px_0_var(--color-border)] max-sm:pr-2',
        headerNav && 'md:pl-4',
      )}
    >
      {/* 햄버거는 접힌 사이드바 레일(독 레일과 같은 40px 열·28px 버튼)과 같은
          열에 놓여 아래 레일 아이콘과 세로로 정렬된다 */}
      <div
        className={cn('flex shrink-0 justify-center', headerNav && 'md:hidden')}
        style={{ width: SCENE_DOCK_RAIL_COLUMN_WIDTH }}
      >
        <button
          onClick={toggle}
          className="hover:bg-accent hover:text-accent-foreground inline-flex size-7 cursor-pointer items-center justify-center rounded-[min(var(--radius-md),12px)]"
          aria-label={t('header.toggleSidebar')}
        >
          <MenuIcon className="size-4" />
        </button>
      </div>

      <AppLink
        to="/"
        className="focus-visible:ring-ring flex shrink-0 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        aria-label={t('common:nav.dockStatus')}
      >
        <HanwhaIcon />
        {/* 헤더 메뉴 계정은 md~xl 에서 글자를 빼고 로고만 둔다 — 메뉴가 한 줄에 들어가도록 */}
        <span
          className={cn(
            'text-lg font-semibold',
            headerNav && 'md:max-xl:hidden',
          )}
        >
          {t(brand.primary)}{' '}
          <span className="text-[#f5a623]">{t(brand.accent)}</span>
        </span>
      </AppLink>
      {APP_ENV_BADGE && (
        // 휴대폰 폭에선 시계 자리를 위해 환경 배지를 뺀다(운영엔 배지가 없다).
        <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] leading-none font-semibold tracking-wider text-amber-600 max-sm:hidden dark:text-amber-400">
          {APP_ENV_BADGE}
        </span>
      )}

      {headerNav && <AppHeaderNav className="ml-1 hidden md:flex xl:ml-3" />}

      <div className="min-w-0 flex-1">
        <HeaderStatusStrip compact={headerNav} />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-3 max-sm:gap-1">
        <HeaderAlarmButton />
        <PageSettings />
      </div>
    </header>
  );
}
