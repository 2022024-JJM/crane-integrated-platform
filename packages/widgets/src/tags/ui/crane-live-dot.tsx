import { useTranslation } from 'react-i18next';
import {
  resolveCraneLiveState,
  type CraneSnapshotEntry,
} from '@crane/features/3d';
import { StatusDot } from '@crane/ui/atoms/status-dot';
import { cn } from '@crane/core/lib/utils';

/**
 * 크레인 상태 점 하나로 온라인과 heartbeat 를 함께 — 초록 맥동(live) /
 * 노랑(stale: 값은 오는데 heartbeat 정지) / 회색(off). 설명은 툴팁(title).
 */
export function CraneLiveDot({
  entry,
  now,
  connected,
  className,
}: {
  entry: Pick<CraneSnapshotEntry, 'snapshot' | 'receivedAt' | 'heartbeatAt'>;
  now: number;
  connected: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const state = resolveCraneLiveState(entry, now, connected);
  const title = t(
    state === 'off'
      ? connected
        ? 'monitoring:tags.liveState.offline'
        : 'monitoring:tags.liveState.disconnected'
      : `monitoring:tags.liveState.${state}`,
  );
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      className={cn('relative inline-flex size-2 shrink-0', className)}
    >
      {state === 'live' ? (
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-green-500/60 motion-reduce:hidden"
        />
      ) : null}
      {state === 'off' ? (
        <span className="bg-muted-foreground/60 relative inline-block size-2 rounded-full" />
      ) : (
        <StatusDot
          status={state === 'live' ? 'normal' : 'warning'}
          className="relative size-2"
        />
      )}
    </span>
  );
}
