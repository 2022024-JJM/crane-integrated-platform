import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@crane/core/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../molecules/tooltip';

/**
 * 숫자 입력 — 네이티브 `type="number"` 대신 쓴다.
 *
 * 네이티브 스핀 버튼은 shadow DOM 이라 테마 색을 입힐 수 없고 좁은 입력에서
 * 글자를 가린다. 여기서는 `type="text" inputMode="decimal"` 위에 chevron
 * 스테퍼를 직접 그린다.
 *
 * - 스테퍼는 **호버·포커스 시에만** 보인다. 절대 배치 오버레이라 평소엔 폭을
 *   차지하지 않고(좁은 필드에서 글자가 잘리지 않게), 나타날 때만 입력의
 *   오른쪽 여백을 그만큼 비운다.
 * - 스테퍼를 **누르고 있으면 연속 증감**한다(400ms 뒤부터 60ms 간격). 한계에
 *   닿으면 멈춘다. 결과는 step·현재 값의 자릿수로 반올림해 부동소수 찌꺼기가
 *   붙지 않는다.
 * - 스테퍼 두 버튼은 grid 2행이라 높이가 항상 같다(구분선은 아래 버튼의
 *   border-t). 별도 1px 구분 요소를 두면 좁은 높이에서 반올림으로 아래 버튼이
 *   1px 작아 보인다.
 * - 마우스 휠로는 값이 바뀌지 않는다. 방향키(↑/↓) step 은 유지.
 * - 타이핑은 blur/Enter 에 commit, Escape 는 되돌린다.
 * - `editPreview` 를 켜면 **편집 중(포커스 + 타이핑 시작)** 입력창 위에 툴팁으로
 *   입력 문자열 전체와 단위를 크게 보여 준다. 좁은 필드(인스펙터 h-6·11px)에서
 *   글자가 잘려 무엇을 치는지 알 수 없는 문제의 답이다. 포커스만으로는 뜨지
 *   않고(draft 없음), 범위 밖 값이면 실제 commit 될 clamp 결과를 함께 적는다.
 */

/** 누르고 있을 때 반복 시작까지의 지연·간격(ms). */
const HOLD_DELAY_MS = 400;
const HOLD_INTERVAL_MS = 60;

/** 소수 자릿수. 1e-7 같은 지수 표기도 센다. */
function countDecimals(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const text = String(n);
  const exp = /e-(\d+)$/.exec(text);
  if (exp)
    return Number(exp[1]) + (text.split('.')[1]?.split('e')[0].length ?? 0);
  return text.split('.')[1]?.length ?? 0;
}

/**
 * step 을 더한 결과를 step 과 현재 값의 자릿수로 반올림한다 — 13.39 + 0.1 이
 * 부동소수 오차로 13.489999999999995 가 되는 것을 막는다.
 */
function addStep(value: number, step: number, direction: 1 | -1): number {
  const precision = Math.min(
    10,
    Math.max(countDecimals(step), countDecimals(value)),
  );
  return Number((value + direction * step).toFixed(precision));
}

interface InputNumberProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> {
  /** null 이면 빈 칸(placeholder)으로 표시한다 — "값 없음"이 의미인 필드용. */
  value: number | null;
  onChange: (value: number) => void;
  /**
   * 빈 문자열로 blur/Enter 했을 때 호출. 없으면 지금처럼 무시하고 이전 값을
   * 되돌린다(값이 반드시 있어야 하는 필드). 있으면 호출자가 "없음"으로 처리.
   */
  onEmpty?: () => void;
  min?: number;
  max?: number;
  step?: number;
  /** 비포커스 시 표시 문자열(단위 접미사 등). 포커스/편집 중엔 raw 숫자를 보여준다. */
  format?: (value: number) => string;
  /** 내부 <input>에 병합할 클래스. className은 래퍼 div로 가므로 별도 prop. */
  inputClassName?: string;
  /** 편집 중(포커스 + 입력 있음) 입력창 위에 전체 값을 툴팁으로 띄운다. 좁은 필드용. */
  editPreview?: boolean;
  /** 미리보기 뒤에 붙일 단위 문자열(°, m 등). editPreview 일 때만 쓰인다. */
  unit?: string;
}

/**
 * 편집 중 미리보기 문구. draft 는 친 그대로('' / '-' 포함) 보여 주고, 유한수인데
 * clamp 로 값이 바뀌면 commit 될 값을 뒤에 덧붙인다.
 */
function previewParts(
  draft: string,
  clamp: (v: number) => number,
): { typed: string; clamped: number | null } {
  const parsed = parseFloat(draft);
  if (!Number.isFinite(parsed)) return { typed: draft, clamped: null };
  const clamped = clamp(parsed);
  return { typed: draft, clamped: clamped === parsed ? null : clamped };
}

function InputNumber({
  value,
  onChange,
  onEmpty,
  min,
  max,
  step = 1,
  format,
  className,
  inputClassName,
  editPreview = false,
  unit,
  onFocus,
  onBlur,
  onKeyDown,
  disabled,
  ...props
}: InputNumberProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // format이 있을 때만 의미 있음 — 포커스 중엔 포맷 문자열 대신 raw 숫자 편집.
  // 포커스 시 draft는 세우지 않는다: 타이핑 없이 blur하면 지금처럼 no-op이어야
  // 동일값 onChange로 인한 히스토리/dirty 오염이 없다.
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 연속 증감 중 최신 값. 호출부가 값을 비동기로 반영해도 누적이 끊기지 않게
  // 각 step 뒤 즉시 갱신하고, 렌더 값과는 effect 로 동기화한다.
  const valueRef = useRef<number>(value ?? 0);
  useEffect(() => {
    valueRef.current = value ?? 0;
  }, [value]);

  const holdTimeoutRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);

  const clamp = useCallback(
    (v: number) => {
      let result = v;
      if (min !== undefined) result = Math.max(min, result);
      if (max !== undefined) result = Math.min(max, result);
      return result;
    },
    [min, max],
  );

  const commit = useCallback(
    (raw: string) => {
      if (raw.trim() === '' && onEmpty) {
        onEmpty();
        setDraft(null);
        return;
      }
      const parsed = parseFloat(raw);
      if (!Number.isNaN(parsed)) {
        onChange(clamp(parsed));
      }
      setDraft(null);
    },
    [onChange, onEmpty, clamp],
  );

  /** 한 step 적용. 한계에 막혀 값이 안 변하면 false — 반복을 멈추는 신호. */
  const stepBy = useCallback(
    (direction: 1 | -1): boolean => {
      const next = clamp(addStep(valueRef.current, step, direction));
      if (next === valueRef.current) return false;
      valueRef.current = next;
      onChange(next);
      return true;
    },
    [clamp, onChange, step],
  );

  const stopHold = useCallback(() => {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  const startHold = useCallback(
    (direction: 1 | -1, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      stopHold();
      if (!stepBy(direction)) return;
      holdTimeoutRef.current = window.setTimeout(() => {
        holdIntervalRef.current = window.setInterval(() => {
          if (!stepBy(direction)) stopHold();
        }, HOLD_INTERVAL_MS);
      }, HOLD_DELAY_MS);
    },
    [stepBy, stopHold],
  );

  // 언마운트 시 타이머 정리.
  useEffect(() => stopHold, [stopHold]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit(e.currentTarget.value);
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setDraft(null);
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepBy(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepBy(-1);
    }
    onKeyDown?.(e);
  };

  const stepButtonClassName =
    'flex cursor-pointer items-center justify-center px-1 text-white/40 transition-colors select-none hover:bg-white/5 hover:text-white/80';

  const wrapperClassName = cn(
    'group border-border bg-background focus-within:border-ring focus-within:ring-ring/50 relative flex overflow-hidden rounded-lg border transition-colors focus-within:ring-3',
    disabled && 'opacity-50',
    className,
  );

  const field = (
    <>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={
          draft ??
          (value === null
            ? ''
            : focused || !format
              ? String(value)
              : format(value))
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v === '' || v === '-' || /^-?\d*\.?\d*$/.test(v)) {
            setDraft(v);
          }
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          if (draft !== null) commit(draft);
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          // 스테퍼는 절대 배치 오버레이라 평소엔 폭을 차지하지 않는다. 호버·
          // 포커스로 스테퍼가 나타날 때만 그만큼 오른쪽 여백을 비워 글자를 안
          // 가린다(inputClassName 의 px 보다 뒤에 두어 twMerge 가 이기게).
          'min-w-0 flex-1 bg-transparent px-2.5 text-sm tabular-nums outline-none disabled:pointer-events-none',
          inputClassName,
          !disabled && 'group-focus-within:pr-5 group-hover:pr-5',
        )}
        {...props}
      />
      {!disabled ? (
        <div className="border-border pointer-events-none absolute inset-y-0 right-0 grid grid-rows-2 border-l bg-inherit opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            tabIndex={-1}
            aria-label="increment"
            className={stepButtonClassName}
            onPointerDown={(event) => startHold(1, event)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="decrement"
            className={cn(stepButtonClassName, 'border-border border-t')}
            onPointerDown={(event) => startHold(-1, event)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      ) : null}
    </>
  );

  if (!editPreview) {
    return <div className={wrapperClassName}>{field}</div>;
  }

  // 제어형 open — 호버로는 열지 않고 편집 중에만 연다. Trigger 는 래퍼 div 를
  // 그대로 앵커로 쓰고, Content 는 포털이라 overflow-hidden·스크롤 영역에
  // 잘리지 않는다.
  const preview = draft === null ? null : previewParts(draft, clamp);
  return (
    <Tooltip open={focused && preview !== null}>
      <TooltipTrigger render={<div className={wrapperClassName} />}>
        {field}
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="gap-1 px-2.5 py-1 text-sm font-medium tabular-nums"
      >
        <span>
          {preview?.typed}
          {unit}
        </span>
        {preview?.clamped != null ? (
          <span className="text-background/60 font-normal">
            → {preview.clamped}
            {unit}
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

export { InputNumber };
export type { InputNumberProps };
