import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  GoliathCraneDetail,
  GoliathSafetyParameter,
} from '@crane/domain/goliath-crane';
import { cn } from '@crane/core/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@crane/ui/molecules/card';
import { Separator } from '@crane/ui/atoms/separator';

const statusColor: Record<string, string> = {
  normal: 'text-emerald-500',
  warning: 'text-amber-500',
  critical: 'text-red-500',
};

const statusBg: Record<string, string> = {
  normal: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

function SafetyRow({ param }: { param: GoliathSafetyParameter }) {
  const { t } = useTranslation('goliath-crane');
  const percent = Math.min((param.currentValue / param.threshold) * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t(param.nameKey)}</span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-semibold tabular-nums',
              statusColor[param.status],
            )}
          >
            {param.currentValue.toFixed(1)}
          </span>
          <span className="text-muted-foreground text-xs">
            / {param.threshold} {param.unit}
          </span>
        </div>
      </div>
      <div className="bg-muted/40 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            statusBg[param.status],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ProtectionIndicator({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2.5',
        active ? 'bg-emerald-500/10' : 'bg-red-500/10',
      )}
    >
      {active ? (
        <ShieldCheck className="size-4 text-emerald-500" />
      ) : (
        <ShieldAlert className="size-4 text-red-500" />
      )}
      <span className="text-sm font-medium">{label}</span>
      <span
        className={cn(
          'ml-auto text-xs font-semibold',
          active ? 'text-emerald-500' : 'text-red-500',
        )}
      >
        {active ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

export function AlarmSafetyPanel({
  crane,
  safetyParams,
}: {
  crane: GoliathCraneDetail;
  safetyParams: GoliathSafetyParameter[];
}) {
  const { t } = useTranslation('goliath-crane');
  const hasWarnings = safetyParams.some((p) => p.status !== 'normal');

  return (
    <Card className="border-border/90 bg-card/60 border shadow-sm backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={cn(
              'size-4',
              hasWarnings ? 'text-amber-500' : 'text-emerald-500',
            )}
          />
          <CardTitle>{t('safety.title')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Safety Parameters */}
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t('safety.safetyParameters')}
          </p>
          <div className="space-y-3">
            {safetyParams.map((param) => (
              <SafetyRow key={param.id} param={param} />
            ))}
          </div>
        </div>

        <Separator />

        {/* Protection Status */}
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t('safety.protectionStatus')}
          </p>
          <div className="space-y-2">
            <ProtectionIndicator
              active={crane.antiCollisionActive}
              label={t('safety.antiCollision')}
            />
            <ProtectionIndicator
              active={crane.overloadProtectionActive}
              label={t('safety.overloadProtection')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
