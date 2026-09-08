import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
} from '@vis.gl/react-google-maps';
import { useRegionRealtimeAlarms } from '@crane/features/alarm';
import {
  deriveRegionStatus,
  getRegionShortCode,
  getRegionSubtitleKey,
  getRegionTitleKey,
  type LatLng,
  type Region,
} from '@crane/domain/region';
import type { BasemapTone } from '../model/region-map-types';
import { useHoverIntent } from '../model/use-hover-intent';
import { RegionMarker } from './region-marker';
import { RegionMarkerHoverCard } from './region-marker-hover-card';

type RegionWithCenter = Region & { center: LatLng };

interface LiveRegionMarkerProps {
  region: RegionWithCenter;
  basemap: BasemapTone;
  hovered: boolean;
  onNavigate: () => void;
  onHoverChange: (regionId: string | null) => void;
}

export function LiveRegionMarker({
  region,
  basemap,
  hovered,
  onNavigate,
  onHoverChange,
}: LiveRegionMarkerProps) {
  const { t } = useTranslation();
  const { stats } = useRegionRealtimeAlarms(region.id);
  const statusLevel = useMemo(() => deriveRegionStatus(stats), [stats]);

  const handleHoverChange = useCallback(
    (next: boolean) => onHoverChange(next ? region.id : null),
    [onHoverChange, region.id],
  );
  const { onPointerEnter, onPointerLeave } = useHoverIntent(handleHoverChange);

  const shortCode = getRegionShortCode(region.id);
  const label = t(getRegionTitleKey(region.id));
  const subtitle = t(getRegionSubtitleKey(region.id));
  const statusLabel = t(`common:status.${statusLevel}`, {
    defaultValue: statusLevel,
  });

  const totalCranes =
    region.statusSummary.normal +
    region.statusSummary.warning +
    region.statusSummary.critical;
  const warningCount = stats.high + stats.medium;

  return (
    <AdvancedMarker
      position={region.center}
      title={label}
      zIndex={hovered ? 22 : 21}
      clickable
      // 마커 박스의 아래 가장자리가 좌표 — 그 위에 측량 표식 중심이 맞춰진다.
      anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM_CENTER}
      onClick={onNavigate}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <RegionMarkerHoverCard
        visible={hovered}
        regionId={region.id}
        statusLevel={statusLevel}
        shortCode={shortCode}
        label={label}
        subtitle={subtitle}
        statusLabel={statusLabel}
        craneCount={totalCranes}
        warningCount={warningCount}
        criticalCount={stats.critical}
      />
      <RegionMarker
        active={hovered}
        regionId={region.id}
        label={label}
        shortCode={shortCode}
        statusLevel={statusLevel}
        basemap={basemap}
        warningCount={warningCount}
        criticalCount={stats.critical}
        onActivate={onNavigate}
      />
    </AdvancedMarker>
  );
}
