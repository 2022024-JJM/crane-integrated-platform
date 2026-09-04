import { useTranslation } from 'react-i18next';
import { Anchor } from 'lucide-react';
import type { StatusLevel } from '@crane/core/types/status';
import type { Site } from '@crane/domain/region';
import { getSiteIdentity } from '../lib/marker-identity';
import type { BasemapTone } from '../model/region-map-types';
import { MapMarkerNode } from './map-marker-node';

interface SiteMarkerProps {
  site: Site;
  status: StatusLevel;
  basemap: BasemapTone;
  warningCount: number;
  criticalCount: number;
  active: boolean;
  onActivate: () => void;
}

/** World 레벨 마커 — region 마커보다 스템을 길게 줘 계층이 눈에 띄게 한다 */
const SITE_STEM_LENGTH = 28;

export function SiteMarker({
  site,
  status,
  basemap,
  warningCount,
  criticalCount,
  active,
  onActivate,
}: SiteMarkerProps) {
  const { t } = useTranslation();

  return (
    <MapMarkerNode
      statusLevel={status}
      basemap={basemap}
      glyph={<Anchor className="size-4" strokeWidth={2} />}
      identity={getSiteIdentity(site.id)}
      label={t(site.displayNameKey)}
      warningCount={warningCount}
      criticalCount={criticalCount}
      warningLabel={t('monitoring-overview:map.kpi.warning')}
      criticalLabel={t('monitoring-overview:map.kpi.critical')}
      active={active}
      onActivate={onActivate}
      stemLength={SITE_STEM_LENGTH}
    />
  );
}
