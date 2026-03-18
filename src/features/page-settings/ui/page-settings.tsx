import { Check, ChevronDown, Settings, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@/shared/config/i18n';
import { useTheme } from '@/shared/lib/theme-context';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/atoms/button';
import { Switch } from '@/shared/ui/atoms/switch';

export function PageSettings() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function closeSettings() {
    setIsSettingsOpen(false);
    setIsLanguageMenuOpen(false);
    triggerRef.current?.blur();
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!settingsRef.current?.contains(event.target as Node)) {
        closeSettings();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeSettings();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const languageOptions = [
    { value: 'ko', label: t('header.koreanLabel') },
    { value: 'en', label: t('header.englishLabel') },
    { value: 'la', label: t('header.latinLabel') },
  ] as const;

  const currentLanguageLabel =
    languageOptions.find((option) => option.value === i18n.language)?.label ??
    languageOptions[0].label;

  return (
    <div ref={settingsRef} className="group relative">
      <Button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setIsSettingsOpen((prev) => {
            const next = !prev;
            if (!next) {
              setIsLanguageMenuOpen(false);
              triggerRef.current?.blur();
            }
            return next;
          });
        }}
        className={cn(
          'bg-card text-card-foreground border-border/80 flex h-9 max-w-9 min-w-9 cursor-pointer items-center justify-center gap-0 overflow-hidden rounded-full px-0 shadow-[0_10px_30px_rgba(15,23,42,0.12)] transition-[max-width,padding,gap,box-shadow,transform,background-color,border-color] duration-300 ease-out hover:max-w-44 hover:justify-start hover:gap-1.5 hover:px-3 hover:shadow-[0_14px_38px_rgba(15,23,42,0.16)] dark:shadow-[0_12px_34px_rgba(0,0,0,0.32)] dark:hover:shadow-[0_16px_42px_rgba(0,0,0,0.38)]',
          isSettingsOpen &&
            'max-w-44 justify-start gap-1.5 px-3 shadow-[0_14px_38px_rgba(15,23,42,0.16)] dark:shadow-[0_16px_42px_rgba(0,0,0,0.38)]',
        )}
        variant="outline"
        aria-label={t('header.pageSettings')}
        aria-expanded={isSettingsOpen}
        aria-haspopup="dialog"
      >
        <span
          className={cn(
            'pointer-events-none max-w-0 overflow-hidden pl-0.5 text-sm font-medium tracking-[-0.02em] whitespace-nowrap opacity-0 transition-[max-width,opacity,transform] duration-300 ease-out group-hover:max-w-32 group-hover:opacity-100',
            isSettingsOpen && 'max-w-32 opacity-100',
          )}
        >
          {t('header.pageSettings')}
        </span>
        <Settings
          className="text-foreground size-3.5 shrink-0"
          strokeWidth={2.1}
        />
      </Button>

      <div
        className={cn(
          'pointer-events-none absolute top-12 right-0 z-50 w-80 translate-y-2 opacity-0 transition-all duration-250 ease-out',
          isSettingsOpen && 'pointer-events-auto translate-y-0 opacity-100',
        )}
      >
        <div className="bg-muted/96 border-border/70 rounded-xl border p-2 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between px-3 py-2">
            <h3 className="text-base font-semibold tracking-[-0.02em]">
              {t('header.pageSettings')}
            </h3>
            <Button
              type="button"
              onClick={closeSettings}
              className="text-muted-foreground hover:bg-background/80 hover:text-foreground rounded-full"
              variant="ghost"
              size="icon"
              aria-label={t('header.closeSettings')}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="bg-card border-border/70 rounded-lg border p-4 shadow-sm">
              <div className="space-y-3">
                <h4 className="text-[15px] font-semibold">
                  {t('header.regionLanguageSection')}
                </h4>
                <div className="relative">
                  <Button
                    type="button"
                    onClick={() => setIsLanguageMenuOpen((prev) => !prev)}
                    className="h-auto w-full justify-between rounded-md px-4 py-3 text-left text-sm font-medium"
                    variant="outline"
                    aria-expanded={isLanguageMenuOpen}
                    aria-haspopup="listbox"
                  >
                    <span>{currentLanguageLabel}</span>
                    <ChevronDown
                      className={cn(
                        'text-muted-foreground size-4 transition-transform',
                        isLanguageMenuOpen && 'rotate-180',
                      )}
                    />
                  </Button>

                  <div
                    className={cn(
                      'pointer-events-none absolute top-[calc(100%+0.35rem)] left-0 z-10 w-full translate-y-1 opacity-0 transition-all duration-200',
                      isLanguageMenuOpen &&
                        'pointer-events-auto translate-y-0 opacity-100',
                    )}
                  >
                    <div className="bg-popover border-border rounded-md border p-1 shadow-lg">
                      {languageOptions.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            void i18n.changeLanguage(option.value);
                            setIsLanguageMenuOpen(false);
                          }}
                          className={cn(
                            'h-auto w-full justify-between rounded-md px-3 py-2 text-sm',
                            i18n.language === option.value &&
                              'bg-accent text-accent-foreground',
                          )}
                          variant="ghost"
                          role="option"
                          aria-selected={i18n.language === option.value}
                        >
                          <span>{option.label}</span>
                          {i18n.language === option.value ? (
                            <Check className="size-4" />
                          ) : null}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card border-border/70 rounded-lg border p-4 shadow-sm">
              <div className="space-y-3">
                <h4 className="text-[15px] font-semibold">
                  {t('header.themeSection')}
                </h4>
                <div className="flex items-center justify-between gap-4 rounded-md">
                  <span className="text-sm font-medium">
                    {t('header.themeModeLabel')}
                  </span>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                    aria-label={t('header.toggleTheme')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
