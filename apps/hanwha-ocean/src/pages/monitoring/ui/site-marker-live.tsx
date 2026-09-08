import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
} from '@vis.gl/react-google-maps';
import type { Site } from '@crane/domain/region';
import type { BasemapTone } from '../model/region-map-types';
import { useHoverIntent } from '../model/use-hover-intent';
import { useSiteRealtimeStats } from '../model/use-site-realtime-stats';
import { useSiteRealtimeStatus } from '../model/use-site-realtime-status';
import { SiteMarker } from './site-marker';
import { SiteMarkerHoverCard } from './site-marker-hover-card';

interface LiveSiteMarkerProps {
  site: Site;
  basemap: BasemapTone;
  onEnter: () => void;
}

export function LiveSiteMarker({
  site,
  basemap,
  onEnter,
}: LiveSiteMarkerProps) {
  const { t } = useTranslation();
  const status = useSiteRealtimeStatus(site);
  // 마커 배지와 hover 카드가 같은 수치를 보도록 여기서 한 번만 집계한다.
  const stats = useSiteRealtimeStats(site);
  const [hovered, setHovered] = useState(false);
  const { onPointerEnter, onPointerLeave } = useHoverIntent(setHovered);

  return (
    <AdvancedMarker
      position={site.center}
      title={t(site.displayNameKey)}
      zIndex={hovered ? 25 : 20}
      clickable
      // 마커 박스의 아래 가장자리가 좌표 — 그 위에 측량 표식 중심이 맞춰진다.
      anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM_CENTER}
      onClick={onEnter}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <SiteMarkerHoverCard
        site={site}
        status={status}
        stats={stats}
        visible={hovered}
      />
      <SiteMarker
        site={site}
        status={status}
        basemap={basemap}
        warningCount={stats.warning}
        criticalCount={stats.critical}
        active={hovered}
        onActivate={onEnter}
      />
    </AdvancedMarker>
  );
}
