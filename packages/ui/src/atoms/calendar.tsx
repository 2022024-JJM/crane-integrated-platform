import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DayPicker,
  type DayPickerProps,
  type DayPickerLocale,
} from 'react-day-picker';
import { enUS, ko } from 'react-day-picker/locale';
import { cn } from '@crane/core/lib/utils';

function resolveRdpLocale(localeCode: string | undefined): DayPickerLocale {
  if (!localeCode) return enUS;
  const lower = localeCode.toLowerCase();
  if (lower.startsWith('ko')) return ko;
  return enUS;
}

type CalendarProps = DayPickerProps & {
  localeCode?: string;
};

function Calendar({
  className,
  classNames,
  localeCode,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      {...(props as DayPickerProps)}
      locale={resolveRdpLocale(localeCode)}
      showOutsideDays
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'space-y-3',
        month_caption:
          'flex justify-center pt-1 relative items-center text-sm font-medium',
        caption_label: 'text-sm font-medium',
        nav: 'absolute inset-x-1 top-1 flex items-center justify-between',
        button_previous: cn(
          'inline-flex size-7 items-center justify-center rounded-md',
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          'disabled:opacity-30 disabled:pointer-events-none',
        ),
        button_next: cn(
          'inline-flex size-7 items-center justify-center rounded-md',
          'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          'disabled:opacity-30 disabled:pointer-events-none',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'text-muted-foreground w-8 text-[0.75rem] font-normal text-center',
        week: 'flex w-full mt-1',
        day: cn(
          'size-8 p-0 text-sm text-center',
          'has-[button[data-selected-single=true]]:bg-primary',
          'has-[button[data-selected-single=true]]:text-primary-foreground',
          'has-[button[data-range-start=true]]:bg-primary',
          'has-[button[data-range-start=true]]:text-primary-foreground',
          'has-[button[data-range-end=true]]:bg-primary',
          'has-[button[data-range-end=true]]:text-primary-foreground',
          'has-[button[data-range-middle=true]]:bg-accent',
          'has-[button[data-range-middle=true]]:text-accent-foreground',
          '[&:has(button[data-range-start=true])]:rounded-l-md',
          '[&:has(button[data-range-end=true])]:rounded-r-md',
          '[&:has(button[data-range-middle=true])]:rounded-none',
          'first:[&:has([aria-selected])]:rounded-l-md',
          'last:[&:has([aria-selected])]:rounded-r-md',
        ),
        day_button: cn(
          'inline-flex size-8 items-center justify-center rounded-md font-normal',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:opacity-40 disabled:pointer-events-none',
        ),
        today: 'font-semibold text-primary',
        outside: 'text-muted-foreground/50',
        disabled: 'text-muted-foreground/40 pointer-events-none',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...rest }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
          return <Icon className={cn('size-4', chevronClassName)} {...rest} />;
        },
      }}
    />
  );
}

export { Calendar };
export type { CalendarProps };
