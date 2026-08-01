import type { ReactNode } from 'react';
import { KC } from './kc';

/** 활동 타임라인 행 (날짜 좌측 + 색 바 카드) */
export function KcActivityRow({
  date,
  tone,
  onClick,
  children,
}: {
  date: string;
  /** 좌측 색 바 */
  tone: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-[64px] shrink-0 pt-2 text-right text-[10.5px]" style={{ color: KC.faint }}>
        {date}
      </div>
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? (e) => (e.key === 'Enter' ? onClick() : undefined) : undefined}
        className={`mb-2 flex-1 rounded-[4px] border ${onClick ? 'kc-hover cursor-pointer' : ''}`}
        style={{ borderColor: KC.hairline, borderLeft: `4px solid ${tone}`, background: KC.bg }}
      >
        {children}
      </div>
    </div>
  );
}
