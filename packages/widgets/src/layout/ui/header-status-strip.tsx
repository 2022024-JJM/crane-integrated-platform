import { CalendarDays, Clock3, type LucideProps } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ComponentType } from 'react';
import { useHeaderWeatherPill } from '@crane/features/weather';
import {
  formatLocalizedDate,
  formatLocalizedTime,
  useCurrentDateTime,
} from '@crane/core/lib/use-date-time';
import {
  useHeaderDisplaySettings,
} from '@crane/core/lib/header-display-settings-context';
import { cn } from '@crane/core/lib/utils';

export function HeaderStatusStrip() {
  const { i18n } = useTranslation();
  const { showDate, showTime, showWeather } = useHeaderDisplaySettings();
  const currentDateTime = useCurrentDateTime();

  if (!showDate && !showTime && !showWeather) {
    return null;
  }

  return (
    <div className="flex min-w-0 justify-end">
      <div className="flex max-w-full items-center justify-end gap-2 overflow-x-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showWeather ? <HeaderWeatherInfoPill /> : null}

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
      </div>
    </div>
  );
}

function HeaderWeatherInfoPill() {
  const { Icon, label, temperatureText, status } = useHeaderWeatherPill();

  // "정보 없음 --°"를 상시 노출하는 것보다 없는 게 낫다 — 데이터가 준비되면 나타난다
  if (status !== 'success') return null;

  return (
    <HeaderInfoPill icon={Icon} value={label} accentValue={temperatureText} />
  );
}

function HeaderInfoPill({
  icon: Icon,
  value,
  accentValue,
  className,
}: {
  icon?: ComponentType<LucideProps>;
  value: string;
  accentValue?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-background/85 text-foreground inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5',
        className,
      )}
    >
      {Icon ? (
        <Icon
          className="text-muted-foreground size-3.5 shrink-0"
          strokeWidth={2.2}
        />
      ) : null}
      <span className="text-[11px] tracking-wide whitespace-nowrap">
        {value}
      </span>
      {accentValue ? (
        <span className="shrink-0 text-[12px] font-semibold whitespace-nowrap tabular-nums">
          {accentValue}
        </span>
      ) : null}
    </div>
  );
}
