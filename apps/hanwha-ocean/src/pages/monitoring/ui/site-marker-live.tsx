import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
} from '@vis.gl/react-google-maps';
import type { Site } from '@crane/domain/region';
import { useSiteRealtimeStatus } from '../model/use-site-realtime-status';
import { SiteMarker } from './site-marker';
import { SiteMarkerHoverCard } from './site-marker-hover-card';

interface LiveSiteMarkerProps {
  site: Site;
  onEnter: () => void;
}

export function LiveSiteMarker({ site, onEnter }: LiveSiteMarkerProps) {
  const { t } = useTranslation();
  const status = useSiteRealtimeStatus(site);
  const [hovered, setHovered] = useState(false);

  return (
    <AdvancedMarker
      position={site.center}
      title={t(site.displayNameKey)}
      zIndex={hovered ? 25 : 20}
      clickable
      // 박스(핀 38x52) 가로 중앙 + 세로 하단(꼬리 끝)이 좌표가 되도록 anchor 지정.
      anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM_CENTER}
      onClick={onEnter}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <SiteMarkerHoverCard site={site} status={status} visible={hovered} />
      <SiteMarker
        site={site}
        status={status}
        active={hovered}
        onActivate={onEnter}
      />
    </AdvancedMarker>
  );
}
