import { useTranslation } from 'react-i18next';
import { RegionMap } from './region-map';

export function RegionMapPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full space-y-6 p-6 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('monitoring-overview:map.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('monitoring-overview:map.description')}
        </p>
      </div>

      <RegionMap />
    </div>
  );
}
