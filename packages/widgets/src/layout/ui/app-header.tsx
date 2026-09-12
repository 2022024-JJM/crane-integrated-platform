import { MenuIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageSettings } from '@crane/features/page-settings';
import { useSidebar } from '@crane/core/lib/sidebar-context';
import { useAuth } from '@crane/features/auth';
import { AppLink } from '@crane/ui/atoms/app-link';
import { HanwhaIcon } from '@crane/ui/atoms/hanwha-icon';
import { SCENE_DOCK_RAIL_COLUMN_WIDTH } from '@crane/ui/organisms/scene-dock';
import { HeaderAlarmButton } from '@crane/features/alarm';
import { HeaderStatusStrip } from './header-status-strip';
import { getHeaderBrandKeys } from '../lib/header-brand';

export function AppHeader() {
  const { t } = useTranslation();
  const { toggle } = useSidebar();
  const { user } = useAuth();
  const brand = getHeaderBrandKeys(user?.role);

  return (
    <header className="bg-background sticky top-0 z-40 flex h-14 shrink-0 items-center gap-1.5 border-b pr-4 pl-0">
      {/* 햄버거는 접힌 사이드바 레일(독 레일과 같은 40px 열·28px 버튼)과 같은
          열에 놓여 아래 레일 아이콘과 세로로 정렬된다 */}
      <div
        className="flex shrink-0 justify-center"
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
        aria-label={t('common:nav.dashboard')}
      >
        <HanwhaIcon />
        <span className="text-lg font-semibold">
          {t(brand.primary)}{' '}
          <span className="text-[#f5a623]">{t(brand.accent)}</span>
        </span>
      </AppLink>

      <div className="min-w-0 flex-1">
        <HeaderStatusStrip />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <HeaderAlarmButton />
        <PageSettings />
      </div>
    </header>
  );
}
