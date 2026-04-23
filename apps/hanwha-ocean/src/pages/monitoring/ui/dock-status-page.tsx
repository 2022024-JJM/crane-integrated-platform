import { useTranslation } from 'react-i18next';
import { filterRegionsByRole, getRegionsBySiteType } from '@crane/domain/region';
import { useAuth } from '@crane/features/auth';
import { useSiteType } from '@crane/core/lib/site-type-context';
import { RegionCard } from './region-card';

export function DockStatusPage() {
  const { t } = useTranslation();
  const { siteType } = useSiteType();
  const { user } = useAuth();
  const filteredRegions = filterRegionsByRole(
    getRegionsBySiteType(siteType),
    user?.role ?? 'philly',
  );

  return (
    <div className="flex flex-col h-full space-y-6 p-6 overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">
          {t('monitoring-overview:dockStatus.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('monitoring-overview:dockStatus.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 lg:grid-cols-6">
        {filteredRegions.map((region) => (
          <RegionCard key={region.id} region={region} />
        ))}
      </div>
    </div>
  );
}
