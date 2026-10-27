import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { KC } from '../../../shared/ui/kc';

/**
 * 현장 화면 틀 — 상단 한 줄(뒤로 + 제목)과 본문. 하단 고정 버튼 영역은
 * 각 화면이 `footer` 로 넘긴다. 헤더·사이드바는 shell 의 AppLayout 이 그린다.
 */
export function FieldShell({
  title,
  onBack,
  backLabel,
  children,
  footer,
}: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="mx-auto flex w-full max-w-[520px] flex-col"
      style={{ minHeight: 'calc(100dvh - 7rem)' }}
    >
      <div className="flex h-12 items-center gap-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded"
            style={{ color: KC.ink }}
          >
            <ChevronLeft size={24} />
          </button>
        ) : null}
        <h1 className="text-[18px] font-bold" style={{ color: KC.ink }}>
          {title}
        </h1>
      </div>
      <div className="flex-1">{children}</div>
      {footer ? (
        <div
          className="sticky bottom-0 -mx-3 mt-4 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-5 md:px-5"
          style={{ background: KC.bg, borderTop: `1px solid ${KC.hairline}` }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** 엄지로 누르는 큰 버튼 — 현장 화면의 기본 CTA. */
export function FieldBigButton({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const primary = variant === 'primary';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center gap-2 rounded text-[16px] font-bold disabled:opacity-40"
      style={{
        background: primary ? KC.tealFill : 'transparent',
        color: primary ? KC.onTeal : KC.ink,
        border: primary ? 'none' : `1px solid ${KC.borderStrong}`,
        borderRadius: KC.radius,
      }}
    >
      {children}
    </button>
  );
}

/** 선택 칩(토글) — 프리셋 증상·우선순위 등. */
export function FieldChip({
  label,
  active,
  onClick,
  activeBg,
  activeText,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeBg?: string;
  activeText?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="min-h-11 rounded px-3.5 text-[15px] font-semibold"
      style={{
        background: active ? (activeBg ?? KC.inverseBg) : KC.bgSubtle,
        color: active ? (activeText ?? KC.inverseText) : KC.ink,
        border: `1px solid ${active ? 'transparent' : KC.border}`,
        borderRadius: KC.radius,
      }}
    >
      {label}
    </button>
  );
}
