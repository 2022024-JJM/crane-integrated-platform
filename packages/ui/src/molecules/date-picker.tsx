import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@crane/core/lib/utils';
import { getFormatLocale } from '@crane/core/config/i18n';
import type { Matcher } from 'react-day-picker';
import { Calendar } from '../atoms/calendar';
import { Popover, PopoverPopup, PopoverTrigger } from './popover';

type Size = 'xs' | 'sm' | 'md';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  size?: Size;
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

function parseYmd(value: string): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatYmd(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
  error,
  placeholder,
  size = 'md',
  className,
  id,
  ariaLabel,
}: DatePickerProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const localeCode = getFormatLocale(i18n.language);
  const selectedDate = parseYmd(value);
  const minDate = parseYmd(min ?? '');
  const maxDate = parseYmd(max ?? '');

  const displayLabel = useMemo(() => {
    if (!selectedDate) return placeholder ?? '';
    return new Intl.DateTimeFormat(localeCode, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(selectedDate);
  }, [selectedDate, localeCode, placeholder]);

  const disabledMatchers: Matcher[] = [];
  if (minDate) disabledMatchers.push({ before: minDate });
  if (maxDate) disabledMatchers.push({ after: maxDate });

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
          !selectedDate && 'text-muted-foreground',
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
          selected={selectedDate}
          defaultMonth={selectedDate}
          onSelect={(day: Date | undefined) => {
            onChange(day ? formatYmd(day) : '');
            if (day) setOpen(false);
          }}
          disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
          localeCode={localeCode}
        />
      </PopoverPopup>
    </Popover>
  );
}

export { DatePicker };
export type { DatePickerProps };
