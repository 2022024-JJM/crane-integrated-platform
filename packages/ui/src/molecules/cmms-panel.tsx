import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';

interface CmmsPanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  /** 'card': 카드형 (기본), 'side': 우측 패널 내부 스트립형 */
  variant?: 'card' | 'side';
  /** side variant 전용 — 남은 높이를 전부 차지 (E-STOP 섹션 등) */
  flex?: boolean;
}

export function CmmsPanel({ title, children, className, variant = 'card', flex = false }: CmmsPanelProps) {
  const isCard = variant === 'card';
  return (
    <div className={cn(
      'overflow-hidden',
      isCard ? 'rounded border border-border bg-card flex flex-col shrink-0' : 'border-b border-border',
      flex && 'flex-1 flex flex-col',
      className,
    )}>
      {/* 헤더: 좌측 accent bar + 구분 배경 */}
      <div className={cn('flex items-stretch border-b border-border', flex && 'shrink-0')}>
        <div className="w-1 bg-sky-500 shrink-0" />
        <div className="flex-1 px-3 py-1.5 bg-muted/60">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-sky-500 dark:text-sky-400">
            {title}
          </h3>
        </div>
      </div>
      <div className={cn('px-3 py-2 space-y-0.5', flex && 'flex-1 overflow-y-auto')}>
        {children}
      </div>
    </div>
  );
}
