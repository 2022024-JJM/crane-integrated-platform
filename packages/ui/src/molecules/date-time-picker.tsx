import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { getFormatLocale } from '@crane/core/config/i18n';
import type { Matcher } from 'react-day-picker';
import { Calendar, type CalendarProps } from '../atoms/calendar';
import { Popover, PopoverPopup, PopoverTrigger } from './popover';
import { TimeScrollPicker } from './time-scroll-picker';

type Size = 'xs' | 'sm' | 'md';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  size?: Size;
  withSeconds?: boolean;
  dateOnly?: boolean;
  /** 달력 캡션 — `dropdown` 이면 월·연 드롭다운. 기본은 글자 라벨. */
  captionLayout?: CalendarProps['captionLayout'];
  /** 달력 이동·드롭다운 연 범위. 생략하면 DayPicker 기본(드롭다운은 100년 전 ~ 올해). */
  startMonth?: Date;
  endMonth?: Date;
  /** 시간 입력 — 브라우저 기본 `<input type="time">` 또는 오전/오후·시·분·초 스크롤. */
  timeInput?: 'native' | 'scroll';
  /**
   * 시간 입력 오른쪽에 툴팁 모양 말풍선으로 띄울 안내(검증 경고 등). 팝업이
   * 아래 폼을 덮으므로 고르는 동안 봐야 하는 안내는 여기로 보낸다. 없으면
   * 아무것도 그리지 않는다.
   */
  timeHint?: ReactNode;
  className?: string;
  id?: string;
  ariaLabel?: string;
}

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'h-7 px-2 text-xs gap-1.5',
  sm: 'h-8 px-2.5 text-xs gap-2',
  md: 'h-9 px-3 py-2 text-sm gap-2',
};

const ICON_PIXELS: Record<Size, number> = {
  xs: 12,
  sm: 14,
  md: 16,
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

interface ParsedDateTime {
  date: Date;
  time: string;
}

function parseDateTimeLocal(value: string): ParsedDateTime | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    value,
  );
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4];
  const minute = match[5];
  const second = match[6];
  const time = second ? `${hour}:${minute}:${second}` : `${hour}:${minute}`;
  return {
    date: new Date(year, month - 1, day),
    time,
  };
}

function formatDateTimeLocal(
  date: Date,
  time: string,
  withSeconds: boolean,
): string {
  const parts = time.split(':');
  const hh = parts[0] ?? '00';
  const mm = parts[1] ?? '00';
  const ss = withSeconds ? (parts[2] ?? '00') : null;
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return ss ? `${dateStr}T${hh}:${mm}:${ss}` : `${dateStr}T${hh}:${mm}`;
}

function defaultTime(withSeconds: boolean): string {
  return withSeconds ? '00:00:00' : '00:00';
}

/**
 * 시간 입력 오른쪽 말풍선 — 앱 툴팁(`TooltipContent`)과 같은 색·모서리·화살표.
 * 툴팁 컴포넌트를 그대로 쓰지 않는 것은 그 Positioner 가 `z-50` 이라 날짜
 * 팝업(`z-9999`) 뒤에 깔리기 때문이다. 팝업 안에 두어 같은 층에 그린다.
 */
function TimeHintBubble({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      data-slot="date-time-picker-hint"
      className={cn(
        'bg-foreground text-background pointer-events-none absolute top-1/2 left-full z-10 ml-3 w-max max-w-60 -translate-y-1/2 rounded-md px-3 py-1.5 text-xs shadow-md',
        'animate-in fade-in-0 zoom-in-95 slide-in-from-left-2',
      )}
    >
      <span
        aria-hidden
        className="bg-foreground absolute top-1/2 -left-1 size-2.5 -translate-y-1/2 rotate-45 rounded-[2px]"
      />
      <span className="relative flex items-center gap-1.5">{children}</span>
    </div>
  );
}

function DateTimePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  error,
  placeholder,
  size = 'md',
  withSeconds = false,
  dateOnly = false,
  captionLayout = 'label',
  startMonth,
  endMonth,
  timeInput = 'native',
  timeHint,
  className,
  id,
  ariaLabel,
}: DateTimePickerProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const localeCode = getFormatLocale(i18n.language);
  const parsed = parseDateTimeLocal(value);
  const minParsed = parseDateTimeLocal(min ?? '');
  const maxParsed = parseDateTimeLocal(max ?? '');

  const displayLabel = useMemo(() => {
    if (!parsed) return placeholder ?? '';
    const timeParts = parsed.time.split(':').map(Number);
    const fullDate = new Date(parsed.date);
    fullDate.setHours(timeParts[0] ?? 0, timeParts[1] ?? 0, timeParts[2] ?? 0);
    return new Intl.DateTimeFormat(localeCode, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: dateOnly ? undefined : '2-digit',
      minute: dateOnly ? undefined : '2-digit',
      second: !dateOnly && withSeconds ? '2-digit' : undefined,
      hour12: false,
    }).format(fullDate);
  }, [parsed, localeCode, placeholder, withSeconds, dateOnly]);

  const disabledMatchers: Matcher[] = [];
  if (minParsed) disabledMatchers.push({ before: minParsed.date });
  if (maxParsed) disabledMatchers.push({ after: maxParsed.date });

  function handleDaySelect(day: Date | undefined) {
    if (!day) {
      onChange('');
      return;
    }
    const currentTime = parsed?.time ?? defaultTime(withSeconds);
    onChange(formatDateTimeLocal(day, currentTime, withSeconds));
  }

  function handleTimeChange(time: string) {
    const currentDate = parsed?.date ?? new Date();
    onChange(
      formatDateTimeLocal(
        currentDate,
        time || defaultTime(withSeconds),
        withSeconds,
      ),
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          'bg-background text-foreground inline-flex w-full items-center rounded-md border transition-colors',
          'border-border hover:border-primary/40',
          'focus:border-ring focus:ring-ring/25 focus:ring-2 focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          SIZE_CLASSES[size],
          error &&
            'border-destructive focus:border-destructive focus:ring-destructive/25',
          !parsed && 'text-muted-foreground',
          className,
        )}
      >
        <span className="flex-1 truncate text-left">
          {displayLabel || placeholder || ''}
        </span>
        <CalendarIcon
          size={ICON_PIXELS[size]}
          stroke="currentColor"
          className="text-foreground shrink-0 opacity-70"
        />
      </PopoverTrigger>
      {/* overflow-visible — 시간 입력 옆 말풍선이 팝업 밖으로 나온다. */}
      <PopoverPopup className="w-auto overflow-visible p-0" align="start">
        <Calendar
          mode="single"
          className="bg-transparent"
          captionLayout={captionLayout}
          startMonth={startMonth}
          endMonth={endMonth}
          selected={parsed?.date}
          defaultMonth={parsed?.date}
          onSelect={handleDaySelect}
          disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
          localeCode={localeCode}
        />
        {dateOnly ? null : timeInput === 'scroll' ? (
          <div className="border-border relative border-t px-3 pt-3 pb-3">
            <TimeScrollPicker
              value={parsed?.time ?? defaultTime(withSeconds)}
              onChange={handleTimeChange}
              withSeconds={withSeconds}
              localeCode={localeCode}
            />
            {timeHint ? <TimeHintBubble>{timeHint}</TimeHintBubble> : null}
          </div>
        ) : (
          <div className="border-border relative flex items-center gap-2 border-t px-3 py-2">
            <Clock className="text-muted-foreground size-3.5 shrink-0" />
            <input
              type="time"
              step={withSeconds ? 1 : 60}
              value={parsed?.time ?? ''}
              onChange={(e) => handleTimeChange(e.target.value)}
              className={cn(
                'border-border bg-background text-foreground flex-1 rounded border px-2 py-1 text-xs',
                'focus:border-ring focus:ring-ring/25 focus:ring-2 focus:outline-none',
              )}
            />
            {timeHint ? <TimeHintBubble>{timeHint}</TimeHintBubble> : null}
          </div>
        )}
      </PopoverPopup>
    </Popover>
  );
}

export { DateTimePicker };
export type { DateTimePickerProps };
