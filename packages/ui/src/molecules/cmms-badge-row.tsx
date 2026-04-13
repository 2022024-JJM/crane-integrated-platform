import type { ReactNode } from 'react';
import type { OnOff } from '@crane/core/types/status';
import { OnOffBadge } from './cmms-status-badge';

interface CmmsBadgeRowProps {
  label: string;
  /** 단일 ReactNode badge — overview처럼 외부에서 badge를 직접 구성할 때 */
  badge?: ReactNode;
  /** OnOff 배열 — hoist/trolley처럼 배열을 OnOffBadge로 렌더링할 때 */
  badges?: readonly OnOff[];
  /** badges.length > 1일 때 flex-col 스택 레이아웃 적용. default: false */
  stacked?: boolean;
}

export function CmmsBadgeRow({ label, badge, badges, stacked = false }: CmmsBadgeRowProps) {
  const isMulti = stacked && (badges?.length ?? 0) > 1;
  return (
    <div className={[
      'py-1 border-b border-border last:border-0',
      isMulti ? 'flex flex-col gap-1' : 'flex items-center justify-between gap-2',
    ].join(' ')}>
      <span className="text-xs text-foreground shrink-0">{label}</span>
      {badge ?? (
        <div className="flex gap-1 flex-wrap shrink-0">
          {badges?.map((v, i) => <OnOffBadge key={i} value={v} />)}
        </div>
      )}
    </div>
  );
}
