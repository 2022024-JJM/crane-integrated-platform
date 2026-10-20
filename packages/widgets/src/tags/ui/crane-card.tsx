import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CraneSnapshotEntry } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { formatClock } from '../lib/format-clock';
import { AgeText } from './age-text';
import { CraneLiveDot } from './crane-live-dot';

/**
 * 크레인 카드 — 상태 점 · 크레인 ID · 태그 개수 · 마지막 수신(시계 아이콘,
 * 오른쪽 정렬, 태그 개수와 같은 작은 흐린 글자). 누르면 상세로. 서버가 오프라인으로 표시한 크레인은 흐리게.
 */
export function CraneCard({
  entry,
  now,
  connected,
  onOpen,
}: {
  entry: CraneSnapshotEntry;
  now: number;
  connected: boolean;
  onOpen: (craneId: string) => void;
}) {
  const { t } = useTranslation();
  const { craneId, online, tags } = entry.snapshot;
  return (
    <button
      type="button"
      onClick={() => onOpen(craneId)}
      className={cn(
        'bg-card text-card-foreground ring-foreground/10 hover:ring-foreground/30 flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-xl p-3 text-left ring-1 transition-[box-shadow,opacity]',
        !online && 'opacity-55 hover:opacity-85',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <CraneLiveDot entry={entry} now={now} connected={connected} />
        <span className="font-mono text-[15px] font-semibold tracking-wide">
          {craneId}
        </span>
        <span className="text-muted-foreground ml-auto text-[11px] whitespace-nowrap">
          {t('monitoring:tags.tagCount', { count: Object.keys(tags).length })}
        </span>
      </span>
      <span
        className="text-muted-foreground flex items-center justify-end gap-1 text-[11px] whitespace-nowrap"
        title={`${t('monitoring:tags.lastReceived')} ${formatClock(entry.receivedAt)}`}
      >
        <Clock className="size-3 shrink-0" aria-hidden />
        <AgeText ageMs={now - entry.receivedAt} />
      </span>
    </button>
  );
}
