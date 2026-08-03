import type { CSSProperties, ReactNode } from 'react';
import { KC } from './kc';

/** CTA 버튼 (Generate Report / New Service Request 계열) */
export function KcButton({
  variant = 'teal',
  children,
  onClick,
  className,
  style,
}: {
  variant?: 'teal' | 'outline' | 'dark';
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const base =
    'inline-flex cursor-pointer items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[12px] font-bold transition-colors';
  const styles: CSSProperties =
    variant === 'teal'
      ? { background: KC.teal, color: '#fff' }
      : variant === 'dark'
        ? { background: KC.inverseBg, color: KC.inverseText }
        : { background: KC.bg, color: KC.teal, border: `1px solid ${KC.teal}` };
  return (
    <button type="button" onClick={onClick} className={`${base} ${className ?? ''}`} style={{ ...styles, ...style }}>
      {children}
    </button>
  );
}
