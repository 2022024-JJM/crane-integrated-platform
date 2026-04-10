import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';

interface CmmsPanelProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function CmmsPanel({ title, children, className }: CmmsPanelProps) {
  return (
    <div className={cn('rounded border border-border bg-card flex flex-col shrink-0', className)}>
      {/* 헤더: 좌측 accent bar + 카드 내 구분 배경 */}
      <div className="flex items-stretch border-b border-border">
        <div className="w-1 bg-sky-500 shrink-0" />
        <div className="flex-1 px-3 py-1.5 bg-muted/60">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-sky-500 dark:text-sky-400">
            {title}
          </h3>
        </div>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}
