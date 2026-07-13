import { useTranslation } from 'react-i18next';
import type { CraneAsset } from '@crane/domain/asset';

// ── 탭: 제원 — 크레인 스펙 필드 그리드 ──
export function AssetSpecsTab({ asset }: { asset: CraneAsset }) {
  const { t } = useTranslation('asset-management');

  const specFields = [
    { label: t('detail.fields.craneType'), value: asset.craneType.toUpperCase() },
    { label: t('detail.fields.manufacturer'), value: asset.manufacturer },
    { label: t('detail.fields.model'), value: asset.model },
    { label: t('detail.fields.capacity'), value: `${asset.capacityTon} ${t('units.ton')}` },
    { label: t('detail.fields.span'), value: asset.spanM ? `${asset.spanM} ${t('units.meter')}` : '—' },
    { label: t('detail.fields.liftHeight'), value: asset.liftHeightM ? `${asset.liftHeightM} ${t('units.meter')}` : '—' },
    { label: t('detail.fields.serialNo'), value: asset.serialNumber },
    { label: t('detail.fields.site'), value: asset.siteName },
    { label: t('detail.fields.location'), value: asset.locationZone },
    { label: t('detail.fields.indoorOutdoor'), value: asset.indoorOutdoor },
    { label: t('detail.fields.installDate'), value: asset.installationDate },
    { label: t('detail.fields.manufactureDate'), value: asset.manufactureDate },
    { label: t('detail.fields.warrantyStart'), value: asset.warrantyStart },
    { label: t('detail.fields.warrantyEnd'), value: asset.warrantyEnd },
    { label: t('detail.fields.oshaClass'), value: asset.oshaClassification },
  ];

  return (
    <div className="rounded-lg border border-border/90 bg-card/60 p-5 shadow-sm">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {specFields.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
