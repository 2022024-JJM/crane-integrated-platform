import type { CSSProperties, ReactNode } from 'react';
import { KC } from './kc';

/** CTA 버튼 (Generate Report / New Service Request 계열) */
export function KcButton({
  variant = 'teal',
  children,
  onClick,
  disabled = false,
  type = 'button',
  className,
  style,
}: {
  variant?: 'teal' | 'outline' | 'dark' | 'ghost';
  children: ReactNode;
  onClick?: () => void;
  /** 비활성 — opacity 만이 아니라 실제 disabled 로 내린다 (포커스·클릭·스크린리더 일치) */
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  style?: CSSProperties;
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[12px] font-bold transition-colors disabled:cursor-not-allowed';
  const styles: CSSProperties =
    variant === 'teal'
      ? { background: KC.tealFill, color: KC.onTeal }
      : variant === 'dark'
        ? { background: KC.inverseBg, color: KC.inverseText }
        : variant === 'ghost'
          ? { background: 'transparent', color: KC.muted, fontWeight: 600 }
          : { background: KC.bg, color: KC.teal, border: `1px solid ${KC.teal}` };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${disabled ? '' : 'cursor-pointer'} ${className ?? ''}`}
      style={{ ...styles, ...(disabled ? { opacity: 0.5 } : null), ...style }}
    >
      {children}
    </button>
  );
}
