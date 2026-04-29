import { MenuIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@crane/features/auth';
import { PageSettings } from '@crane/features/page-settings';
import { useSidebar } from '@crane/core/lib/sidebar-context';
import { AppLink } from '@crane/ui/atoms/app-link';
import { HanwhaIcon } from '@crane/ui/atoms/hanwha-icon';
import { HeaderAlarmButton } from '@crane/features/alarm';
import { HeaderStatusStrip } from './header-status-strip';

function useHomeHref() {
  const { user } = useAuth();
  return user?.role === 'philly' ? '/philly-dashboard' : '/';
}

export function AppHeader() {
  const { t } = useTranslation();
  const { toggle } = useSidebar();
  const homeHref = useHomeHref();

  return (
    <header className="bg-background sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <button
        onClick={toggle}
        className="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md"
        aria-label={t('header.toggleSidebar')}
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <AppLink
        to={homeHref}
        className="focus-visible:ring-ring flex shrink-0 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        aria-label={t('common:nav.dashboard')}
      >
        <HanwhaIcon />
        <span className="text-lg font-semibold">
          {t('header.brandPrimary')}{' '}
          <span className="text-[#f5a623]">{t('header.brandAccent')}</span>
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
