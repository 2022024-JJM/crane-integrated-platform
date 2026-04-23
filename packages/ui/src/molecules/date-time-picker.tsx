import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { getFormatLocale } from '@crane/core/config/i18n';
import type { Matcher } from 'react-day-picker';
import { Calendar } from '../atoms/calendar';
import { Popover, PopoverPopup, PopoverTrigger } from './popover';

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
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
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
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: false,
    }).format(fullDate);
  }, [parsed, localeCode, placeholder, withSeconds]);

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
    onChange(formatDateTimeLocal(currentDate, time || defaultTime(withSeconds), withSeconds));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          'inline-flex w-full items-center rounded-md border bg-background text-foreground transition-colors',
          'border-border hover:border-primary/40',
          'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25',
          'disabled:cursor-not-allowed disabled:opacity-50',
          SIZE_CLASSES[size],
          error && 'border-destructive focus:border-destructive focus:ring-destructive/25',
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
          className="shrink-0 text-foreground opacity-70"
        />
      </PopoverTrigger>
      <PopoverPopup className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed?.date}
          defaultMonth={parsed?.date}
          onSelect={handleDaySelect}
          disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
          localeCode={localeCode}
        />
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="time"
            step={withSeconds ? 1 : 60}
            value={parsed?.time ?? ''}
            onChange={(e) => handleTimeChange(e.target.value)}
            className={cn(
              'flex-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground',
              'focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25',
            )}
          />
        </div>
      </PopoverPopup>
    </Popover>
  );
}

export { DateTimePicker };
export type { DateTimePickerProps };
