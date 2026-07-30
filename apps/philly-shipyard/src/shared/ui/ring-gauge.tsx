import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';

/**
 * 순수 SVG 링 게이지 — 0~100 값을 시계 방향으로 채운다.
 * (대시보드 MetricDonut은 recharts 세그먼트 도넛 — 용도가 달라 별도 유지)
 */
export function RingGauge({
  value,
  color,
  size = 96,
  strokeWidth = 8,
  children,
  className,
}: {
  /** 0~100 */
  value: number;
  /** TONE_FILL hex 등 stroke 색 */
  color: string;
  size?: number;
  strokeWidth?: number;
  /** 중앙 오버레이 */
  children?: ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={cn('relative inline-flex', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
