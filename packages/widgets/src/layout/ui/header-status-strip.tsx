import { CalendarDays, Clock3, type LucideProps } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ComponentType } from 'react';
import { useHeaderWeatherPill } from '@crane/features/weather';
import {
  formatLocalizedDate,
  formatLocalizedTime,
  useCurrentDateTime,
} from '@crane/core/lib/use-date-time';
import { useHeaderDisplaySettings } from '@crane/core/lib/header-display-settings-context';
import { cn } from '@crane/core/lib/utils';

/**
 * `compact` — 헤더 가로 메뉴가 같은 줄에 선 계정. 메뉴에 자리를 주려고 lg 미만에서는
 * 날씨·날짜를 빼고 시계만 남긴다(브라우저 확대로 폭이 줄 때 칸이 잘리지 않게).
 */
export function HeaderStatusStrip({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const { showDate, showTime, showWeather } = useHeaderDisplaySettings();
  const currentDateTime = useCurrentDateTime();

  if (!showDate && !showTime && !showWeather) {
    return null;
  }

  // 좁은 화면(휴대폰)에선 시계만 남긴다 — 날씨·날짜까지 두면 폭을 넘겨 시계
  // 왼쪽이 잘린다. 오른쪽 정렬은 `ml-auto` 로: `justify-end` 는 내용이 넘칠 때
  // 왼쪽으로 흘러 스크롤도 안 되는 영역으로 밀어낸다.
  return (
    <div className="flex min-w-0">
      <div className="ml-auto flex max-w-full items-center gap-2 overflow-x-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showWeather ? (
          <HeaderWeatherInfoPill
            className={compact ? 'max-lg:hidden' : 'max-md:hidden'}
          />
        ) : null}

        {showDate ? (
          <HeaderInfoPill
            icon={CalendarDays}
            value={formatLocalizedDate(currentDateTime, i18n.language)}
            className={compact ? 'max-lg:hidden' : 'max-md:hidden'}
          />
        ) : null}

        {showTime ? (
          <>
            {/* 아주 좁은 폭(작은 휴대폰)은 초를 뺀 시각만 — 잘리는 것보다 낫다. */}
            <HeaderInfoPill
              icon={Clock3}
              iconClassName="max-md:hidden"
              value={formatLocalizedTime(currentDateTime, i18n.language)}
              className="max-sm:hidden"
            />
            <HeaderInfoPill
              value={formatLocalizedTime(currentDateTime, i18n.language, {
                seconds: false,
              })}
              className="sm:hidden"
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function HeaderWeatherInfoPill({ className }: { className?: string }) {
  const { Icon, label, temperatureText, status } = useHeaderWeatherPill();

  // "정보 없음 --°"를 상시 노출하는 것보다 없는 게 낫다 — 데이터가 준비되면 나타난다
  if (status !== 'success') return null;

  return (
    <HeaderInfoPill
      icon={Icon}
      value={label}
      accentValue={temperatureText}
      className={className}
    />
  );
}

function HeaderInfoPill({
  icon: Icon,
  iconClassName,
  value,
  accentValue,
  className,
}: {
  icon?: ComponentType<LucideProps>;
  /** 좁은 화면에서 아이콘만 빼고 값은 남길 때. */
  iconClassName?: string;
  value: string;
  accentValue?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border bg-background/85 text-foreground inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5 max-sm:px-1.5',
        className,
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            'text-muted-foreground size-3.5 shrink-0',
            iconClassName,
          )}
          strokeWidth={2.2}
        />
      ) : null}
      <span className="text-box-cap text-[11px] tracking-wide whitespace-nowrap">
        {value}
      </span>
      {accentValue ? (
        <span className="text-box-cap shrink-0 text-[12px] font-semibold whitespace-nowrap tabular-nums">
          {accentValue}
        </span>
      ) : null}
    </div>
  );
}
