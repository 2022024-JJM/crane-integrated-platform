import { useTranslation } from 'react-i18next';
import type { StatusLevel } from '@crane/core/types/status';
import { Anchor } from 'lucide-react';
import type { Site } from '@crane/domain/region';
import { getSiteIdentity } from '../lib/marker-identity';
import type { SiteRealtimeStats } from '../model/use-site-realtime-stats';
import {
  HoverKpiCell,
  HoverKpiGrid,
  MarkerHoverCardShell,
} from './marker-hover-card-shell';
import { MarkerIdentityChip } from './marker-identity-chip';

interface SiteMarkerHoverCardProps {
  site: Site;
  status: StatusLevel;
  /** 마커 배지와 같은 집계를 쓰도록 상위(LiveSiteMarker)에서 내려받는다 */
  stats: SiteRealtimeStats;
  visible: boolean;
}

// 마커 박스 기준 위쪽에 띄우는 hover summary.
export function SiteMarkerHoverCard({
  site,
  status,
  stats,
  visible,
}: SiteMarkerHoverCardProps) {
  const { t } = useTranslation();

  const displayName = t(site.displayNameKey);
  const country = t(site.countryKey, { defaultValue: '' });
  const statusLabel = t(`common:status.${status}`, { defaultValue: status });

  return (
    <MarkerHoverCardShell
      visible={visible}
      statusLevel={status}
      title={displayName}
      subtitle={country || undefined}
      statusLabel={statusLabel}
      category={t('monitoring-overview:map.marker.siteCategory')}
      actionHint={t('monitoring-overview:map.site.enter')}
      // 마커 칩과 같은 색·같은 글리프를 넘겨 "이 카드가 저 마커의 것" 을 잇는다
      leadingBadge={
        <MarkerIdentityChip identity={getSiteIdentity(site.id)}>
          <Anchor className="size-3.5" strokeWidth={2.25} />
        </MarkerIdentityChip>
      }
    >
      <HoverKpiGrid>
        <HoverKpiCell
          label={t('monitoring-overview:map.marker.cranes')}
          value={stats.cranes}
          tone="neutral"
        />
        <HoverKpiCell
          label={t('monitoring-overview:map.kpi.warning')}
          value={stats.warning}
          tone="warning"
        />
        <HoverKpiCell
          label={t('monitoring-overview:map.kpi.critical')}
          value={stats.critical}
          tone="critical"
        />
      </HoverKpiGrid>
    </MarkerHoverCardShell>
  );
}
