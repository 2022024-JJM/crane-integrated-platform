import { useTranslation } from 'react-i18next';
import type { CraneAsset } from '@crane/domain/asset';
import { cn } from '@crane/core/lib/utils';
import { SURFACE_CARD } from '../../../shared/ui/surface';

// ── 탭: 제원 — 크레인 스펙 필드 그리드 ──
export function AssetSpecsTab({ asset }: { asset: CraneAsset }) {
  const { t } = useTranslation('asset-management');

  const specFields = [
    { label: t('detail.fields.craneType'), value: t(`craneType.${asset.craneType}`, { defaultValue: asset.craneType.toUpperCase() }) },
    { label: t('detail.fields.manufacturer'), value: asset.manufacturer },
    { label: t('detail.fields.model'), value: asset.model },
    { label: t('detail.fields.capacity'), value: `${asset.capacityTon} ${t('units.ton')}` },
    { label: t('detail.fields.span'), value: asset.spanM ? `${asset.spanM} ${t('units.meter')}` : '—' },
    { label: t('detail.fields.liftHeight'), value: asset.liftHeightM ? `${asset.liftHeightM} ${t('units.meter')}` : '—' },
    { label: t('detail.fields.serialNo'), value: asset.serialNumber },
    { label: t('detail.fields.site'), value: asset.siteName },
    { label: t('detail.fields.location'), value: asset.locationZone },
    { label: t('detail.fields.indoorOutdoor'), value: t(`modal.indoorOutdoor.${asset.indoorOutdoor}`, { defaultValue: asset.indoorOutdoor }) },
    { label: t('detail.fields.installDate'), value: asset.installationDate },
    { label: t('detail.fields.manufactureDate'), value: asset.manufactureDate },
    { label: t('detail.fields.warrantyStart'), value: asset.warrantyStart },
    { label: t('detail.fields.warrantyEnd'), value: asset.warrantyEnd },
    { label: t('detail.fields.oshaClass'), value: asset.oshaClassification },
  ];

  return (
    <div className={cn(SURFACE_CARD, 'p-5')}>
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
