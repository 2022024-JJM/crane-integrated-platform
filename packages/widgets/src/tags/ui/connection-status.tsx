import { Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CraneFeedConnection } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';

const TONE: Record<CraneFeedConnection, string> = {
  open: 'text-emerald-500',
  connecting: 'text-amber-500 animate-pulse motion-reduce:animate-none',
  reconnecting: 'text-red-500',
  off: 'text-muted-foreground',
};

/** 연결 상태 — 와이파이 아이콘(색). 상태 이름은 기본 툴팁·접근성 라벨, `withLabel` 이면 글자로. */
export function ConnectionStatus({
  connection,
  withLabel = false,
  className,
}: {
  connection: CraneFeedConnection;
  /** 아이콘 옆에 상태 이름을 쓴다(설정 팝업의 상태 줄). 기본은 툴팁만. */
  withLabel?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const Icon =
    connection === 'open' || connection === 'connecting' ? Wifi : WifiOff;
  const label = t(`monitoring:tags.connection.${connection}`);
  return (
    <span
      role={withLabel ? undefined : 'img'}
      aria-label={withLabel ? undefined : label}
      title={withLabel ? undefined : label}
      className={cn('inline-flex items-center gap-1.5', className)}
    >
      <Icon className={cn('size-4 shrink-0', TONE[connection])} aria-hidden />
      {withLabel ? <span className="font-medium">{label}</span> : null}
    </span>
  );
}
