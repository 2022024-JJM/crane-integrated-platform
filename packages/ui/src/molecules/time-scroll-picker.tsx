import {
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { cn } from '@crane/core/lib/utils';

/** 한 칸 높이(px). 가운데 하이라이트 띠와 같다. */
const ITEM_HEIGHT = 28;
/** 열에 보이는 칸 수(홀수). 가운데 칸이 선택값이다. */
const VISIBLE_ITEMS = 5;
const PAD_ITEMS = (VISIBLE_ITEMS - 1) / 2;
const COLUMN_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
/** `scrollend` 가 없는 브라우저에서 스크롤이 멈춘 뒤 확정하기까지 기다리는 시간(ms). */
const SETTLE_MS = 150;

type DayPeriod = 'am' | 'pm';

interface PickerOption {
  value: string;
  label: string;
}

interface TimeScrollPickerProps {
  /** `HH:mm:ss` 또는 `HH:mm`(24시간). 빈 값이나 못 읽는 조각은 0 으로 본다. */
  value: string;
  onChange: (value: string) => void;
  withSeconds?: boolean;
  /** 오전·오후 표기 로케일(BCP 47). 생략하면 브라우저 기본. */
  localeCode?: string;
  className?: string;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function clampPart(part: string | undefined, limit: number) {
  const parsed = Number.parseInt(part ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= limit) return 0;
  return parsed;
}

function parseTime(value: string) {
  const [h, m, s] = value.split(':');
  return {
    hour24: clampPart(h, 24),
    minute: clampPart(m, 60),
    second: clampPart(s, 60),
  };
}

function toTwelveHour(hour24: number): { period: DayPeriod; hour12: number } {
  const period: DayPeriod = hour24 >= 12 ? 'pm' : 'am';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { period, hour12 };
}

function toTwentyFourHour(period: DayPeriod, hour12: number) {
  const base = hour12 % 12;
  return period === 'pm' ? base + 12 : base;
}

/** 로케일의 오전·오후 글자(ko: 오전/오후, en: AM/PM). 못 얻으면 AM/PM. */
function dayPeriodLabels(localeCode: string | undefined) {
  const read = (hour: number) => {
    try {
      const parts = new Intl.DateTimeFormat(localeCode, {
        hour: 'numeric',
        hour12: true,
      }).formatToParts(new Date(2000, 0, 1, hour));
      return parts.find((part) => part.type === 'dayPeriod')?.value ?? null;
    } catch {
      return null;
    }
  };
  return { am: read(9) ?? 'AM', pm: read(21) ?? 'PM' };
}

function numberOptions(from: number, to: number): PickerOption[] {
  const options: PickerOption[] = [];
  for (let n = from; n <= to; n += 1) {
    options.push({ value: String(n), label: pad(n) });
  }
  return options;
}

const HOUR_OPTIONS = numberOptions(1, 12);
const SIXTY_OPTIONS = numberOptions(0, 59);

interface ScrollColumnProps {
  options: PickerOption[];
  value: string;
  onSelect: (value: string) => void;
  ariaLabel: string;
}

/** `scrollend` 를 주는 브라우저면 그걸로 확정하고, 아니면 멈춤 타이머로 대신한다. */
const SUPPORTS_SCROLL_END =
  typeof window !== 'undefined' && 'onscrollend' in window;

/**
 * 세로 스크롤 열 하나. 칸 높이가 고정이라 `scrollTop / 칸 높이` 가 곧 선택
 * index 다. 휠·드래그·터치는 브라우저 스크롤에 맡기고(스냅으로 칸에 맞춰
 * 선다), 스크롤이 끝난 뒤 가운데 칸을 확정한다. 클릭·방향키는 바로 고른다.
 *
 * 값이 바뀌어 열을 옮길 때는 즉시 이동한다. 부드럽게 옮기면 그 도중의
 * 스크롤 이벤트가 중간 칸을 확정해 버린다(39 를 눌렀는데 23 이 들어가던 원인).
 */
function ScrollColumn({
  options,
  value,
  onSelect,
  ariaLabel,
}: ScrollColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  // 값이 바뀌면(초기값·클릭·방향키·다른 열의 영향) 그 칸을 가운데로 옮긴다.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const top = selectedIndex * ITEM_HEIGHT;
    if (Math.abs(list.scrollTop - top) >= 1) {
      list.scrollTo({ top, behavior: 'auto' });
    }
  }, [selectedIndex]);

  useEffect(
    () => () => {
      if (settleTimer.current !== null)
        window.clearTimeout(settleTimer.current);
    },
    [],
  );

  const commitCenter = () => {
    const list = listRef.current;
    if (!list) return;
    const index = Math.min(
      options.length - 1,
      Math.max(0, Math.round(list.scrollTop / ITEM_HEIGHT)),
    );
    const option = options[index];
    if (option && option.value !== value) onSelect(option.value);
  };

  const handleScroll = () => {
    if (SUPPORTS_SCROLL_END) return;
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(commitCenter, SETTLE_MS);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (event.key === 'ArrowUp') next = selectedIndex - 1;
    else if (event.key === 'ArrowDown') next = selectedIndex + 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    if (next === null) return;
    event.preventDefault();
    const option = options[Math.min(options.length - 1, Math.max(0, next))];
    if (option) onSelect(option.value);
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={handleScroll}
      onScrollEnd={SUPPORTS_SCROLL_END ? commitCenter : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative min-w-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        'rounded-md focus-visible:outline-none',
      )}
      style={{
        height: COLUMN_HEIGHT,
        paddingBlock: PAD_ITEMS * ITEM_HEIGHT,
      }}
    >
      {options.map((option, index) => (
        <div
          key={option.value}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => onSelect(option.value)}
          className={cn(
            'flex cursor-pointer snap-center items-center justify-center text-sm tabular-nums select-none',
            index === selectedIndex
              ? 'text-foreground font-medium'
              : 'text-muted-foreground',
          )}
          style={{ height: ITEM_HEIGHT }}
        >
          {option.label}
        </div>
      ))}
    </div>
  );
}

/**
 * 오전/오후 · 시(12시간) · 분 · 초 를 세로로 굴려 고르는 시간 선택기. 외부
 * 라이브러리 없이 브라우저 스크롤 + 스냅으로 만든다. 값은 24시간 문자열로
 * 주고받는다.
 */
function TimeScrollPicker({
  value,
  onChange,
  withSeconds = true,
  localeCode,
  className,
}: TimeScrollPickerProps) {
  const parsed = useMemo(() => parseTime(value), [value]);
  const twelve = toTwelveHour(parsed.hour24);
  const periodLabels = useMemo(() => dayPeriodLabels(localeCode), [localeCode]);
  const periodOptions = useMemo<PickerOption[]>(
    () => [
      { value: 'am', label: periodLabels.am },
      { value: 'pm', label: periodLabels.pm },
    ],
    [periodLabels],
  );

  const emit = (hour24: number, minute: number, second: number) => {
    onChange(
      withSeconds
        ? `${pad(hour24)}:${pad(minute)}:${pad(second)}`
        : `${pad(hour24)}:${pad(minute)}`,
    );
  };

  return (
    <div
      className={cn(
        'border-border/60 bg-background relative flex w-full gap-1 rounded-lg border px-1.5',
        className,
      )}
    >
      {/* 가운데 하이라이트 띠 — 열 뒤에 깔린다. */}
      <div
        aria-hidden
        className="bg-accent pointer-events-none absolute inset-x-1.5 top-1/2 -translate-y-1/2 rounded-md"
        style={{ height: ITEM_HEIGHT }}
      />
      {/* 위·아래 흐림 — 가운데에서 멀수록 옅어 보이게. */}
      <div
        aria-hidden
        className="from-background pointer-events-none absolute inset-x-0 top-0 z-10 h-8 rounded-t-lg bg-gradient-to-b to-transparent"
      />
      <div
        aria-hidden
        className="from-background pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 rounded-b-lg bg-gradient-to-t to-transparent"
      />
      <ScrollColumn
        options={periodOptions}
        value={twelve.period}
        onSelect={(next) =>
          emit(
            toTwentyFourHour(next as DayPeriod, twelve.hour12),
            parsed.minute,
            parsed.second,
          )
        }
        ariaLabel="period"
      />
      <ScrollColumn
        options={HOUR_OPTIONS}
        value={String(twelve.hour12)}
        onSelect={(next) =>
          emit(
            toTwentyFourHour(twelve.period, Number(next)),
            parsed.minute,
            parsed.second,
          )
        }
        ariaLabel="hour"
      />
      <ScrollColumn
        options={SIXTY_OPTIONS}
        value={String(parsed.minute)}
        onSelect={(next) => emit(parsed.hour24, Number(next), parsed.second)}
        ariaLabel="minute"
      />
      {withSeconds ? (
        <ScrollColumn
          options={SIXTY_OPTIONS}
          value={String(parsed.second)}
          onSelect={(next) => emit(parsed.hour24, parsed.minute, Number(next))}
          ariaLabel="second"
        />
      ) : null}
    </div>
  );
}

export { TimeScrollPicker };
export type { TimeScrollPickerProps };
