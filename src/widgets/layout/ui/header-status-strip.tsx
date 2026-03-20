import { CalendarDays, Clock3, type LucideIcon, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  formatLocalizedDate,
  formatLocalizedTime,
  useCurrentDateTime,
} from '@/shared/lib/use-date-time';
import {
  type HeaderHealthStatus,
  useHeaderDisplaySettings,
} from '@/shared/lib/header-display-settings-context';
import { cn } from '@/shared/lib/utils';

const HEADER_HEALTH_STATUS: HeaderHealthStatus = 'online';

export function HeaderStatusStrip() {
  const { t, i18n } = useTranslation();
  const { showDate, showTime, showHealthcheck } = useHeaderDisplaySettings();
  const currentDateTime = useCurrentDateTime();

  if (!showDate && !showTime && !showHealthcheck) {
    return null;
  }

  return (
    <div className="flex min-w-0 justify-end">
      <div className="flex max-w-full items-center justify-end gap-2 overflow-x-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showDate ? (
          <HeaderInfoPill
            icon={CalendarDays}
            value={formatLocalizedDate(currentDateTime, i18n.language)}
          />
        ) : null}

        {showTime ? (
          <HeaderInfoPill
            icon={Clock3}
            value={formatLocalizedTime(currentDateTime, i18n.language)}
          />
        ) : null}

        {showHealthcheck ? (
          <HeaderInfoPill
            icon={Wifi}
            value={t(`header.${HEADER_HEALTH_STATUS}`)}
            variant="status"
          />
        ) : null}
      </div>
    </div>
  );
}

function HeaderInfoPill({
  icon: Icon,
  value,
  variant = 'default',
}: {
  icon: LucideIcon;
  value: string;
  variant?: 'default' | 'status';
}) {
  return (
    <div
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5',
        variant === 'default'
          ? 'border-border bg-background/85 text-foreground'
          : 'text-foreground border-emerald-500/50 bg-emerald-500/8',
      )}
    >
      <Icon
        className={cn(
          'size-3.5 shrink-0',
          variant === 'default'
            ? 'text-muted-foreground'
            : 'text-emerald-500 dark:text-emerald-300',
        )}
        strokeWidth={2.2}
      />
      <span
        className={cn(
          'text-[11px] tracking-widest tabular-nums',
          variant === 'status' && 'text-emerald-600 dark:text-emerald-300',
        )}
      >
        {value}
      </span>
      {variant === 'status' ? (
        <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.65)]" />
      ) : null}
    </div>
  );
}
