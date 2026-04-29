import { useTranslation } from 'react-i18next';
import { Layers } from 'lucide-react';
import { SectionCard } from './section-card';
import { MetricDonut } from './metric-donut';
import { KCC_FILL } from '../constants/konecranes-colors';

interface AssetFleetCardProps {
  agreementPct: number;
  connectedPct: number;
  totalAssets: number;
  operatingCranes: number;
  connectedCount: number;
}

export function AssetFleetCard({
  agreementPct,
  connectedPct,
  totalAssets,
  operatingCranes,
  connectedCount,
}: AssetFleetCardProps) {
  const { t } = useTranslation('philly-dashboard');

  return (
    <SectionCard
      title={t('assetFleet.title')}
      icon={Layers}
      accent="success"
      href="/asset-management"
    >
      <div className="space-y-4">
        <FleetRow
          pct={agreementPct}
          fillColor={KCC_FILL.info}
          label={t('assetFleet.agreementAssets')}
          subLabel={`${operatingCranes}/${totalAssets} ${t('assetFleet.assetsUnit', { defaultValue: 'Assets' })}`}
        />
        <FleetRow
          pct={connectedPct}
          fillColor={KCC_FILL.success}
          label={t('assetFleet.connectedAssets')}
          subLabel={`${connectedCount}/${totalAssets} ${t('assetFleet.assetsUnit', { defaultValue: 'Assets' })}`}
        />
      </div>
    </SectionCard>
  );
}

function FleetRow({
  pct,
  fillColor,
  label,
  subLabel,
}: {
  pct: number;
  fillColor: string;
  label: string;
  subLabel: string;
}) {
  const segments = [
    { key: 'fill', value: pct, color: fillColor },
    { key: 'rest', value: Math.max(0, 100 - pct), color: 'var(--muted)' },
  ];

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-muted p-3">
      <MetricDonut segments={segments} centerNumber={`${pct}%`} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="text-muted-foreground text-xs tabular-nums">{subLabel}</p>
      </div>
    </div>
  );
}
