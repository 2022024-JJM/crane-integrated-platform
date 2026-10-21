import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
  type DayPickerLocale,
} from 'react-day-picker';
import { enUS, ko } from 'react-day-picker/locale';
import { cn } from '@crane/core/lib/utils';
import { Button, buttonVariants } from './button';

function resolveRdpLocale(localeCode: string | undefined): DayPickerLocale {
  if (!localeCode) return enUS;
  const lower = localeCode.toLowerCase();
  if (lower.startsWith('ko')) return ko;
  return enUS;
}

/**
 * 드롭다운 캡션의 순서 — DayPicker 는 로케일(en 은 월-연)로 정하지만 늘 연·월
 * 순으로 둔다. 요소 key 가 `month`/`year` 로 끝난다. 그 밖(aria-live 상태
 * 문구)은 맨 뒤.
 */
function dropdownRank(node: ReactNode): number {
  const key = isValidElement(node) ? String(node.key ?? '') : '';
  if (key.endsWith('year')) return 0;
  if (key.endsWith('month')) return 1;
  return 2;
}

function orderYearFirst(children: ReactNode): ReactNode[] {
  return [...Children.toArray(children)].sort(
    (left, right) => dropdownRank(left) - dropdownRank(right),
  );
}

/*
 * DayPicker 의 `components` 재정의는 반드시 모듈 스코프 함수여야 한다. 렌더마다
 * 새 함수를 넘기면 React 가 다른 컴포넌트 타입으로 보고 달력 DOM 을 통째로
 * 다시 마운트한다 — 상위가 주기적으로 리렌더하는 화면(3D 플레이 트랜스포트
 * 바)에서 월·연 드롭다운이 열리자마자 닫히던 원인이다.
 */
type DayPickerComponents = NonNullable<
  ComponentProps<typeof DayPicker>['components']
>;

const CalendarRoot: NonNullable<DayPickerComponents['Root']> = ({
  className,
  rootRef,
  ...props
}) => (
  <div
    data-slot="calendar"
    ref={rootRef}
    className={cn(className)}
    {...props}
  />
);

const CalendarDropdownNav: NonNullable<DayPickerComponents['DropdownNav']> = ({
  children,
  ...props
}) => <div {...props}>{orderYearFirst(children)}</div>;

const CalendarChevron: NonNullable<DayPickerComponents['Chevron']> = ({
  className,
  orientation,
  ...props
}) => {
  if (orientation === 'left') {
    return <ChevronLeftIcon className={cn('size-4', className)} {...props} />;
  }
  if (orientation === 'right') {
    return <ChevronRightIcon className={cn('size-4', className)} {...props} />;
  }
  return <ChevronDownIcon className={cn('size-4', className)} {...props} />;
};

const CalendarWeekNumber: NonNullable<DayPickerComponents['WeekNumber']> = ({
  children,
  ...props
}) => (
  <td {...props}>
    <div className="flex size-(--cell-size) items-center justify-center text-center">
      {children}
    </div>
  </td>
);

type CalendarProps = ComponentProps<typeof DayPicker> & {
  buttonVariant?: ComponentProps<typeof Button>['variant'];
  /** BCP 47(ko-KR·en-US). 요일·월 이름과 드롭다운의 월 표기에 쓴다. */
  localeCode?: string;
};

/**
 * shadcn Calendar(react-day-picker v9, Base UI 판 모양). `captionLayout="dropdown"`
 * 이면 캡션이 연·월 드롭다운이 된다 — DayPicker 기본 `<select>` 를 투명하게
 * 덮고 라벨에 글자와 화살표만 그리므로 테두리 없는 shadcn 모양이고 별도
 * Select 컴포넌트가 없다. 연 범위를 주지 않으면 DayPicker 기본(100년 전 ~
 * 올해)이다.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  localeCode,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={resolveRdpLocale(localeCode)}
      className={cn(
        'group/calendar bg-background p-3 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent',
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(localeCode ?? 'default', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn(
          'relative flex flex-col gap-4 md:flex-row',
          defaultClassNames.months,
        ),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          'relative rounded-md has-focus:ring-[3px] has-focus:ring-ring/50',
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          'absolute inset-0 bg-popover opacity-0',
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          'font-medium select-none',
          captionLayout === 'label'
            ? 'text-sm'
            : 'flex h-7 items-center gap-1 rounded-md px-1.5 text-sm hover:bg-accent [&>svg]:size-3.5 [&>svg]:text-muted-foreground',
          defaultClassNames.caption_label,
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground select-none',
          defaultClassNames.weekday,
        ),
        week: cn('mt-2 flex w-full', defaultClassNames.week),
        week_number_header: cn(
          'w-(--cell-size) select-none',
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          'text-[0.8rem] text-muted-foreground select-none',
          defaultClassNames.week_number,
        ),
        day: cn(
          'group/day relative aspect-square h-full w-full rounded-md p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-md',
          props.showWeekNumber
            ? '[&:nth-child(2)[data-selected=true]_button]:rounded-l-md'
            : '[&:first-child[data-selected=true]_button]:rounded-l-md',
          defaultClassNames.day,
        ),
        range_start: cn(
          'relative isolate z-0 rounded-l-md bg-muted after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted',
          defaultClassNames.range_start,
        ),
        range_middle: cn('rounded-none', defaultClassNames.range_middle),
        range_end: cn(
          'relative isolate z-0 rounded-r-md bg-muted after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted',
          defaultClassNames.range_end,
        ),
        today: cn(
          'rounded-md bg-muted text-foreground data-[selected=true]:rounded-none',
          defaultClassNames.today,
        ),
        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside,
        ),
        disabled: cn(
          'text-muted-foreground opacity-50',
          defaultClassNames.disabled,
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: CalendarRoot,
        DropdownNav: CalendarDropdownNav,
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        WeekNumber: CalendarWeekNumber,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-accent-foreground flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md [&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
export type { CalendarProps };
