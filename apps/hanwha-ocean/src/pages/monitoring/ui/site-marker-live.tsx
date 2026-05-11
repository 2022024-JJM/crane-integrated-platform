import { useTranslation } from 'react-i18next';
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
} from '@vis.gl/react-google-maps';
import type { Site } from '@crane/domain/region';
import { useSiteRealtimeStatus } from '../model/use-site-realtime-status';
import { SiteMarker } from './site-marker';

interface LiveSiteMarkerProps {
  site: Site;
  onEnter: () => void;
}

export function LiveSiteMarker({ site, onEnter }: LiveSiteMarkerProps) {
  const { t } = useTranslation();
  const status = useSiteRealtimeStatus(site);

  return (
    <AdvancedMarker
      position={site.center}
      title={t(site.displayNameKey)}
      zIndex={20}
      clickable
      // 박스(핀 38x52) 가로 중앙 + 세로 하단(꼬리 끝)이 좌표가 되도록 anchor 지정.
      anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM_CENTER}
      onClick={onEnter}
    >
      <SiteMarker
        site={site}
        status={status}
        active={false}
        onActivate={onEnter}
      />
    </AdvancedMarker>
  );
}
