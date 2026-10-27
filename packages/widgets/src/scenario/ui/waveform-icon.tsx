import type { VirtualTagPatternKind } from '@crane/domain/virtual-tag';
import { cn } from '@crane/core/lib/utils';

/**
 * 패턴 파형 아이콘 — 가운데 기준선 위에 파형 2주기를 선으로 그린다.
 * currentColor 라 테마 중립. manual 은 파형이 없으므로 기준선 위 손잡이 점.
 */
const PATH: Record<VirtualTagPatternKind, string> = {
  // 정현파: 두 주기(0→48), 진폭 6, 중심 8
  sine: 'M0 8 C3 2 6 2 9 8 S15 14 18 8 S24 2 27 8 S33 14 36 8 S42 2 45 8 L48 8',
  // 삼각파
  triangle: 'M0 8 L6 2 L18 14 L30 2 L42 14 L48 8',
  // 톱니파: 경사 상승 후 수직 낙하
  sawtooth: 'M0 14 L16 2 L16 14 L32 2 L32 14 L48 2',
  // 구형파
  square: 'M0 8 L0 2 L12 2 L12 14 L24 14 L24 2 L36 2 L36 14 L48 14 L48 8',
  manual: '',
};

export function WaveformIcon({
  kind,
  className,
}: {
  kind: VirtualTagPatternKind;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 16"
      width={40}
      height={14}
      aria-hidden="true"
      className={cn('shrink-0 overflow-visible', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1={0} y1={8} x2={48} y2={8} className="opacity-35" />
      {kind === 'manual' ? (
        <circle cx={24} cy={8} r={3} fill="currentColor" stroke="none" />
      ) : (
        <path d={PATH[kind]} />
      )}
    </svg>
  );
}
