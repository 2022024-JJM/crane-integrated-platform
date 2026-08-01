import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { KC, KC_FONT_DISPLAY } from './kc';

/* ── 링 게이지 (Open Risks / Condition %) ───────────────────────────── */

export function KcRing({
  pct,
  color,
  size = 64,
  stroke = 7,
  track = 'var(--kc-track)',
  children,
}: {
  /** 0~100 — 채울 비율 */
  pct: number;
  color: string;
  size?: number;
  stroke?: number;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: track }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={`${(c * filled) / 100} ${c}`}
          strokeLinecap="butt"
          style={{ stroke: color }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/* ── 도넛 차트 (Spend by Service Type) ──────────────────────────────── */

export interface DonutSegment {
  value: number;
  color: string;
}

export function KcDonut({
  segments,
  size = 96,
  stroke = 16,
  children,
}: {
  segments: DonutSegment[];
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((seg, i) => {
          const len = (c * seg.value) / total;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              style={{ stroke: seg.color }}
              strokeDasharray={`${len} ${c}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/* ── 큰 숫자 + 라벨 + 색 언더라인 (3-스탯 트리오의 벽돌) ─────────────── */

export function KcStat({
  value,
  label,
  tone = 'var(--kc-track)',
  size = 'md',
}: {
  value: ReactNode;
  label: string;
  /** 언더라인 색 */
  tone?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <span
        className={size === 'lg' ? 'text-[26px] leading-8' : 'text-[20px] leading-7'}
        style={{ color: KC.ink, fontWeight: 700, fontFamily: KC_FONT_DISPLAY }}
      >
        {value}
      </span>
      <span
        className="border-b-[3px] pb-0.5 text-center text-[10.5px] leading-tight whitespace-pre-line"
        style={{ borderColor: tone, color: KC.muted }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Overview 카드 (아이콘 + 제목 + → 드릴다운) ─────────────────────── */

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
      {to ? <span className="text-[15px]" style={{ color: KC.accent }}>→</span> : null}
    </div>
  );
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[4px] border"
      style={{ borderColor: KC.border, background: KC.bg }}
    >
      {to ? (
        <Link to={to} className="kc-hover block">
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

/* ── ⓘ 아이콘 ───────────────────────────────────────────────────────── */

export function KcInfo({ className }: { className?: string }) {
  return <Info size={14} className={className} style={{ color: KC.ink }} aria-label="More information" />;
}

/* ── 버튼 ───────────────────────────────────────────────────────────── */

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

/* ── 좌측 필터 레일 ─────────────────────────────────────────────────── */

export function KcFilterRail({
  selectedCount,
  onClear,
  children,
}: {
  selectedCount?: number;
  onClear?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation('mro2');
  return (
    <aside className="w-[168px] shrink-0">
      <div className="mb-1 text-[12px] font-bold" style={{ color: KC.ink }}>
        {selectedCount
          ? t('common.filterSelected', { count: selectedCount })
          : t('common.filter')}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="mb-3 block cursor-pointer text-[11px]"
        style={{ color: KC.link }}
      >
        {t('common.clearFilter')}
      </button>
      <div className="flex flex-col gap-3">{children}</div>
    </aside>
  );
}

export function KcFilterGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b pb-2" style={{ borderColor: KC.hairline }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between py-1 text-left text-[11.5px] font-bold"
        style={{ color: KC.ink }}
      >
        {title}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open ? <div className="mt-1 flex flex-wrap gap-1">{children}</div> : null}
    </div>
  );
}

/** 필터 칩 — 좌측 색 보더 + 회색 박스 (매뉴얼의 Service Status 칩 스타일) */
export function KcFilterChip({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  /** 좌측 보더 색 (상태 의미색) — 없으면 무채색 칩 */
  tone?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-[3px] px-1.5 py-0.5 text-[11px]"
      style={{
        background: active ? KC.accent : KC.bgRow,
        color: active ? '#fff' : KC.text,
        borderLeft: tone ? `3px solid ${tone}` : undefined,
      }}
    >
      {label}
    </button>
  );
}

/* ── 활동 타임라인 행 (날짜 좌측 + 색 바 카드) ──────────────────────── */

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

/* ── 섹션 헤딩 (헤어라인 하단) ──────────────────────────────────────── */

export function KcSectionHeading({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      className="mb-3 flex items-end justify-between border-b pb-1.5"
      style={{ borderColor: KC.borderStrong }}
    >
      <h2
        className="text-[18px] font-semibold tracking-wide"
        style={{ color: KC.ink, fontFamily: KC_FONT_DISPLAY }}
      >
        {children}
      </h2>
      {right}
    </div>
  );
}
