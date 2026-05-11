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
import { RegionInfoCard } from './region-info-card';
import { RegionMarkerHoverCard } from './region-marker-hover-card';

type RegionWithCenter = Region & { center: LatLng };

interface LiveRegionMarkerProps {
  region: RegionWithCenter;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onClose: () => void;
  onNavigate: () => void;
  onHoverChange: (regionId: string | null) => void;
}

export function LiveRegionMarker({
  region,
  selected,
  hovered,
  onSelect,
  onClose,
  onNavigate,
  onHoverChange,
}: LiveRegionMarkerProps) {
  const { t } = useTranslation();
  const { stats } = useRegionRealtimeAlarms(region.id);
  const statusLevel = useMemo(() => deriveRegionStatus(stats), [stats]);

  const active = selected || hovered;
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
      zIndex={selected ? 30 : active ? 22 : 21}
      clickable
      // 핀 꼬리 끝이 region 좌표에 닿도록.
      anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM}
      onClick={onSelect}
      onMouseEnter={() => onHoverChange(region.id)}
      onMouseLeave={() => onHoverChange(null)}
    >
      <RegionInfoCard
        statusLevel={statusLevel}
        craneCount={totalCranes}
        label={label}
        subtitle={subtitle}
        statusLabel={statusLabel}
        selected={selected}
        onClose={onClose}
        onNavigate={onNavigate}
      />
      <RegionMarkerHoverCard
        visible={hovered && !selected}
        statusLevel={statusLevel}
        label={label}
        subtitle={subtitle}
        statusLabel={statusLabel}
        craneCount={totalCranes}
        craneCountLabel={t('monitoring-overview:map.marker.craneCount')}
      />
      <RegionMarker
        active={active}
        selected={selected}
        label={label}
        shortCode={getRegionShortCode(region.id)}
        statusLevel={statusLevel}
        onActivate={onSelect}
      />
    </AdvancedMarker>
  );
}
