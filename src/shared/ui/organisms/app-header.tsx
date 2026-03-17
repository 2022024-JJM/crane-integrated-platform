import { Sun, Moon, MenuIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/shared/config/i18n';
import { useSidebar } from '@/shared/lib/sidebar-context';
import { useTheme } from '@/shared/lib/theme-context';
import { HanwhaIcon } from '../atoms/hanwha-icon';

export function AppHeader() {
  const { t } = useTranslation();
  const { toggle } = useSidebar();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-background sticky top-0 z-40 flex h-14 items-center border-b px-4">
      <button
        onClick={toggle}
        className="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md"
        aria-label={t('header.toggleSidebar')}
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <div className="ml-3 flex items-center gap-2">
        <HanwhaIcon />
        <span className="text-lg font-semibold">
          {t('header.brandPrimary')} <span className="text-[#f5a623]">{t('header.brandAccent')}</span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div
          className="mr-1 inline-flex rounded-md border p-0.5"
          role="group"
          aria-label={t('language')}
        >
          <button
            onClick={() => void i18n.changeLanguage('ko')}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              i18n.language === 'ko'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground'
            }`}
            aria-pressed={i18n.language === 'ko'}
          >
            KO
          </button>
          <button
            onClick={() => void i18n.changeLanguage('en')}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              i18n.language === 'en'
                ? 'bg-foreground text-background'
                : 'text-muted-foreground'
            }`}
            aria-pressed={i18n.language === 'en'}
          >
            EN
          </button>
        </div>
        <button
          onClick={toggleTheme}
          className="hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md"
          aria-label={t('header.toggleTheme')}
        >
          {theme === 'light' ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </button>
      </div>
    </header>
  );
}
