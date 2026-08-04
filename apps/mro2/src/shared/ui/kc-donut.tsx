import type { ReactNode } from 'react';

export interface DonutSegment {
  value: number;
  color: string;
  /** hover 시 네이티브 툴팁으로 표시할 라벨 (예: "Planned Repairs — $10,000") */
  label?: string;
}

/** 도넛 차트 (Spend by Service Type) */
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
  // 누적 오프셋 사전 계산 (렌더 중 변수 재할당 금지)
  const arcs = segments.reduce<{ seg: DonutSegment; len: number; offset: number }[]>(
    (acc, seg) => {
      const prev = acc[acc.length - 1];
      const offset = prev ? prev.offset + prev.len : 0;
      acc.push({ seg, len: (c * seg.value) / total, offset });
      return acc;
    },
    [],
  );
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {arcs.map(({ seg, len, offset }, i) => (
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
          >
            {seg.label ? <title>{seg.label}</title> : null}
          </circle>
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
