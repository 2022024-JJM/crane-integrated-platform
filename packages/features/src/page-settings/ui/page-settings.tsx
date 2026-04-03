import { Check, ChevronDown, Moon, Settings, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type SupportedLanguage, i18n } from '@crane/core/config/i18n';
import { useHeaderDisplaySettings } from '@crane/core/lib/header-display-settings-context';
import { useTheme } from '@crane/core/lib/theme-context';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Switch } from '@crane/ui/atoms/switch';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@crane/ui/molecules/toggle-group';

type ThemeOption = 'light' | 'dark';

export function PageSettings() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { showDate, showTime, showHealthcheck, showWeather, setSetting } =
    useHeaderDisplaySettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function closeSettings() {
    setIsSettingsOpen(false);
    setIsLanguageMenuOpen(false);
    triggerRef.current?.blur();
  }

  async function handleLanguageChange(language: SupportedLanguage) {
    await i18n.changeLanguage(language);
    setIsLanguageMenuOpen(false);

    const fixedT = i18n.getFixedT(language, 'common');
    const languageLabel = fixedT(`header.${getLanguageLabelKey(language)}`);

    toast.info(
      fixedT('toast.languageChanged', {
        language: languageLabel,
      }),
    );
  }

  function handleThemeChange(values: string[]) {
    if (values.length === 0) {
      return;
    }

    const nextTheme = values[values.length - 1];
    if (nextTheme !== 'light' && nextTheme !== 'dark') {
      return;
    }

    if (nextTheme === theme) {
      return;
    }

    setTheme(nextTheme);
    toast.info(
      t('common:toast.themeChanged', {
        theme: t(`header.${nextTheme === 'dark' ? 'darkMode' : 'lightMode'}`),
      }),
    );
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
  const themeOptions: Array<{
    value: ThemeOption;
    label: string;
    icon: typeof Sun;
  }> = [
    {
      value: 'light',
      label: t('header.lightMode'),
      icon: Sun,
    },
    {
      value: 'dark',
      label: t('header.darkMode'),
      icon: Moon,
    },
  ];
  const displayOptions = [
    {
      key: 'showWeather' as const,
      label: t('header.showWeather'),
      checked: showWeather,
    },
    {
      key: 'showDate' as const,
      label: t('header.showDate'),
      checked: showDate,
    },
    {
      key: 'showTime' as const,
      label: t('header.showTime'),
      checked: showTime,
    },
    {
      key: 'showHealthcheck' as const,
      label: t('header.showHealthcheck'),
      checked: showHealthcheck,
    },
  ];

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
          'bg-card text-card-foreground border-border/80 flex h-8 max-w-8 min-w-8 cursor-pointer items-center justify-center gap-0 overflow-hidden rounded-full px-0 transition-[max-width,padding,gap,box-shadow,transform,background-color,border-color] duration-300 ease-out hover:max-w-40 hover:justify-start hover:gap-1.5 hover:px-3',
          isSettingsOpen && 'max-w-40 justify-start gap-1.5 px-3',
        )}
        variant="outline"
        aria-label={t('header.pageSettings')}
        aria-expanded={isSettingsOpen}
        aria-haspopup="dialog"
      >
        <span
          className={cn(
            'pointer-events-none max-w-0 overflow-hidden text-[12px] tracking-[-0.02em] whitespace-nowrap opacity-0 transition-[max-width,opacity,transform] duration-300 ease-out group-hover:max-w-32 group-hover:opacity-100',
            isSettingsOpen && 'max-w-32 opacity-100',
          )}
        >
          {t('header.pageSettings')}
        </span>
        <Settings className="text-foreground size-[14px] shrink-0" />
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
                <h4 className="text-[14px] font-semibold">
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
                            void handleLanguageChange(option.value);
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
                <h4 className="text-[14px] font-semibold">
                  {t('header.themeSection')}
                </h4>
                <div>
                  <ToggleGroup
                    value={[theme]}
                    onValueChange={handleThemeChange}
                    aria-label={t('header.themeSection')}
                    className="bg-muted border-border/70 grid w-full grid-cols-2 rounded-lg border p-1"
                  >
                    {themeOptions.map((option) => {
                      const Icon = option.icon;

                      return (
                        <ToggleGroupItem
                          key={option.value}
                          value={option.value}
                          aria-label={option.label}
                          className="text-muted-foreground hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground h-8 justify-center gap-2 rounded-md px-4 py-3 text-sm aria-pressed:shadow-sm"
                        >
                          <Icon className="size-4" />
                          <span>{option.label}</span>
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                </div>
              </div>
            </div>

            <div className="bg-card border-border/70 rounded-lg border p-4 shadow-sm">
              <div className="space-y-3">
                <h4 className="text-[14px] font-semibold">
                  {t('header.displaySection')}
                </h4>
                <div className="space-y-2">
                  {displayOptions.map((option) => (
                    <div
                      key={option.key}
                      className="bg-muted/60 border-border/70 flex items-center justify-between rounded-md border px-3 py-2.5"
                    >
                      <span className="text-[12px] font-medium">
                        {option.label}
                      </span>
                      <Switch
                        checked={option.checked}
                        onCheckedChange={(checked) =>
                          setSetting(option.key, checked)
                        }
                        aria-label={option.label}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getLanguageLabelKey(language: SupportedLanguage) {
  switch (language) {
    case 'ko':
      return 'koreanLabel';
    case 'en':
      return 'englishLabel';
    case 'la':
      return 'latinLabel';
  }
}
