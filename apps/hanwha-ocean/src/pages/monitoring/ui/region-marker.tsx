import { useTranslation } from 'react-i18next';
import type { StatusLevel } from '@crane/core/types/status';
import { getRegionIdentity } from '../lib/marker-identity';
import type { BasemapTone } from '../model/region-map-types';
import { MapMarkerNode } from './map-marker-node';

interface RegionMarkerProps {
  active: boolean;
  /** 식별색 배정 키 — 같은 사이트 안에서 도크끼리 색으로 갈린다 */
  regionId: string;
  label: string;
  shortCode: string;
  statusLevel: StatusLevel;
  basemap: BasemapTone;
  warningCount: number;
  criticalCount: number;
  onActivate: () => void;
}

/** Site 레벨 마커 — 좌표가 서로 가까우므로 스템을 짧게 잡는다 */
const REGION_STEM_LENGTH = 20;

export function RegionMarker({
  active,
  regionId,
  label,
  shortCode,
  statusLevel,
  basemap,
  warningCount,
  criticalCount,
  onActivate,
}: RegionMarkerProps) {
  const { t } = useTranslation();

  return (
    <MapMarkerNode
      statusLevel={statusLevel}
      basemap={basemap}
      // 도크마다 다른 식별색 — 같은 사이트 안에서 D1·D2·내업이 색으로 갈린다
      glyph={shortCode}
      identity={getRegionIdentity(regionId)}
      statusLabel={t(`monitoring-overview:status.${statusLevel}`)}
      label={label}
      warningCount={warningCount}
      criticalCount={criticalCount}
      warningLabel={t('monitoring-overview:map.kpi.warning')}
      criticalLabel={t('monitoring-overview:map.kpi.critical')}
      active={active}
      onActivate={onActivate}
      stemLength={REGION_STEM_LENGTH}
    />
  );
}
