import { useTranslation } from 'react-i18next';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { RegionMap } from './region-map';

export function RegionMapPage() {
  const { t } = useTranslation();
  const { siteType } = useSiteType();

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

      {siteType === 'philly-shipyard' ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed text-muted-foreground">
          Map TBD
        </div>
      ) : (
        <RegionMap />
      )}
    </div>
  );
}
