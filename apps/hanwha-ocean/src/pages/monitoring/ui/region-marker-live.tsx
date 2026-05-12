import { useMemo } from 'react';
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
import { RegionMarker } from './region-marker';
import { RegionMarkerHoverCard } from './region-marker-hover-card';

type RegionWithCenter = Region & { center: LatLng };

interface LiveRegionMarkerProps {
  region: RegionWithCenter;
  hovered: boolean;
  onNavigate: () => void;
  onHoverChange: (regionId: string | null) => void;
}

export function LiveRegionMarker({
  region,
  hovered,
  onNavigate,
  onHoverChange,
}: LiveRegionMarkerProps) {
  const { t } = useTranslation();
  const { stats } = useRegionRealtimeAlarms(region.id);
  const statusLevel = useMemo(() => deriveRegionStatus(stats), [stats]);

  const label = t(getRegionTitleKey(region.id));
  const subtitle = t(getRegionSubtitleKey(region.id));
  const statusLabel = t(`common:status.${statusLevel}`, {
    defaultValue: statusLevel,
  });

  const totalCranes =
    region.statusSummary.normal +
    region.statusSummary.warning +
    region.statusSummary.critical;

  return (
    <AdvancedMarker
      position={region.center}
      title={label}
      zIndex={hovered ? 22 : 21}
      clickable
      // 핀 꼬리 끝이 region 좌표에 닿도록.
      anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM}
      onClick={onNavigate}
      onMouseEnter={() => onHoverChange(region.id)}
      onMouseLeave={() => onHoverChange(null)}
    >
      <RegionMarkerHoverCard
        visible={hovered}
        statusLevel={statusLevel}
        label={label}
        subtitle={subtitle}
        statusLabel={statusLabel}
        craneCount={totalCranes}
        warningCount={stats.high + stats.medium}
        criticalCount={stats.critical}
      />
      <RegionMarker
        active={hovered}
        label={label}
        shortCode={getRegionShortCode(region.id)}
        statusLevel={statusLevel}
        onActivate={onNavigate}
      />
    </AdvancedMarker>
  );
}
