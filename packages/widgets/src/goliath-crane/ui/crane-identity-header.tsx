import { OctagonX, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GoliathCraneDetail } from '@crane/domain/goliath-crane';
import { cn } from '@crane/core/lib/utils';
import { craneStatusBadgeClassName } from '@crane/core/lib/status-colors';
import { Badge } from '@crane/ui/atoms/badge';
import { Button } from '@crane/ui/atoms/button';

function LivePulse() {
  return (
    <span className="relative flex size-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

function HeartbeatLabel({ lastUpdated }: { lastUpdated: string }) {
  const { t } = useTranslation('goliath-crane');
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(lastUpdated).getTime()) / 1000),
  );

  return (
    <div className="flex items-center gap-1.5">
      <LivePulse />
      <span className="text-muted-foreground text-xs tabular-nums">
        {t('header.lastHeartbeat')}:{' '}
        {seconds < 5
          ? t('header.justNow')
          : `${seconds}${t('header.secondsAgo')}`}
      </span>
    </div>
  );
}

export function CraneIdentityHeader({ crane }: { crane: GoliathCraneDetail }) {
  const { t } = useTranslation('goliath-crane');

  return (
    <div className="border-border/90 bg-card/60 flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              {crane.craneNo}
            </h1>
            <Badge
              variant="outline"
              className={cn('border', craneStatusBadgeClassName[crane.status])}
            >
              {t(`status.${crane.status}`)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">{crane.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <HeartbeatLabel lastUpdated={crane.lastUpdated} />
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" className="gap-1.5">
            <OctagonX className="size-3.5" />
            {t('header.emergencyStop')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Wrench className="size-3.5" />
            {t('header.maintenanceMode')}
          </Button>
        </div>
      </div>
    </div>
  );
}
