import { MenuIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageSettings } from '@/features/page-settings';
import { useSidebar } from '@/shared/lib/sidebar-context';
import { HanwhaIcon } from '@/shared/ui/atoms/hanwha-icon';

export function AppHeader() {
  const { t } = useTranslation();
  const { toggle } = useSidebar();

  return (
    <header className="bg-background sticky top-0 z-40 flex h-14 items-center border-b px-4">
      <button
        onClick={toggle}
        className="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md"
        aria-label={t('header.toggleSidebar')}
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <Link
        to="/"
        className="focus-visible:ring-ring ml-3 flex items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        aria-label={t('common:nav.dashboard')}
      >
        <HanwhaIcon />
        <span className="text-lg font-semibold">
          {t('header.brandPrimary')}{' '}
          <span className="text-[#f5a623]">{t('header.brandAccent')}</span>
        </span>
      </Link>

      <div className="ml-auto">
        <PageSettings />
      </div>
    </header>
  );
}
