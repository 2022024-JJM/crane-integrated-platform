import type { ReactNode } from 'react';

/** 링 게이지 (Open Risks / Condition %) */
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
