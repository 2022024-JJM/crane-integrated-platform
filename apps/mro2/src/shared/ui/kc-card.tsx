import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { KC, KC_FONT_DISPLAY } from './kc';

/** Overview 카드 (아이콘 + 제목 + → 드릴다운) */
export function KcCard({
  icon,
  title,
  to,
  children,
}: {
  icon: ReactNode;
  title: string;
  to?: string;
  children?: ReactNode;
}) {
  const header = (
    <div className="flex items-center gap-2 px-3.5 py-2.5">
      <span style={{ color: KC.accent }}>{icon}</span>
      <span
        className="flex-1 text-[14px] font-semibold tracking-wide"
        style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}
      >
        {title}
      </span>
      {to ? (
        <span className="kc-card-arrow text-[15px]" style={{ color: KC.accent }}>
          →
        </span>
      ) : null}
    </div>
  );
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[4px] border"
      style={{ borderColor: KC.border, background: KC.bg }}
    >
      {to ? (
        <Link to={to} className="kc-hover kc-card-link block">
          {header}
        </Link>
      ) : (
        header
      )}
      {children ? (
        <div
          className="flex flex-1 flex-col justify-center border-t px-3 py-3"
          style={{ borderColor: KC.hairline }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
