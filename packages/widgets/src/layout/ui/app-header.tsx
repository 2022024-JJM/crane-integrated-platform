import { MenuIcon, Building2, Anchor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageSettings } from '@crane/features/page-settings';
import { useSidebar } from '@crane/core/lib/sidebar-context';
import { useSiteType, type SiteType } from '@crane/core/lib/site-type-context';
import { cn } from '@crane/core/lib/utils';
import { AppLink } from '@crane/ui/atoms/app-link';
import { HanwhaIcon } from '@crane/ui/atoms/hanwha-icon';
import {
  Select,
  SelectTrigger,
  SelectPopup,
  SelectItem,
} from '@crane/ui/molecules/select';
import { HeaderAlarmButton } from '@crane/features/alarm';
import { HeaderStatusStrip } from './header-status-strip';
import type { LucideIcon } from 'lucide-react';

interface SiteOption {
  value: SiteType;
  icon: LucideIcon;
  labelKey: string;
}

const SITE_OPTIONS: SiteOption[] = [
  {
    value: 'hanwha-ocean',
    icon: Building2,
    labelKey: 'common:siteType.hanwha-ocean',
  },
  {
    value: 'goliath-crane',
    icon: Anchor,
    labelKey: 'common:siteType.goliath-crane',
  },
];

const SITE_OPTION_MAP = new Map(SITE_OPTIONS.map((o) => [o.value, o]));

function SiteTypeSwitcher() {
  const { t, i18n } = useTranslation();
  const { siteType, setSiteType } = useSiteType();
  const navigate = useNavigate();
  void i18n.language;

  const current = SITE_OPTION_MAP.get(siteType) ?? SITE_OPTIONS[0];

  const handleChange = (value: SiteType) => {
    if (value === siteType) return;
    setSiteType(value);
    navigate('/');
  };

  return (
    <Select value={siteType} onValueChange={handleChange}>
      <SelectTrigger
        label={t(current.labelKey)}
        className="border-border/60 bg-muted/30 h-8 gap-2 rounded-lg px-2.5 text-[13px] font-medium"
      />
      <SelectPopup>
        {SITE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = siteType === option.value;
          return (
            <SelectItem
              key={option.value}
              value={option.value}
              className="gap-2.5 py-2"
            >
              <Icon
                className={cn(
                  'size-4',
                  isActive
                    ? 'text-(--hanwha-orange-100)'
                    : 'text-muted-foreground',
                )}
              />
              {t(option.labelKey)}
            </SelectItem>
          );
        })}
      </SelectPopup>
    </Select>
  );
}

export function AppHeader() {
  const { t } = useTranslation();
  const { toggle } = useSidebar();

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
        to="/"
        className="focus-visible:ring-ring flex shrink-0 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        aria-label={t('common:nav.dashboard')}
      >
        <HanwhaIcon />
        <span className="text-lg font-semibold">
          {t('header.brandPrimary')}{' '}
          <span className="text-[#f5a623]">{t('header.brandAccent')}</span>
        </span>
      </AppLink>

      <SiteTypeSwitcher />

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
