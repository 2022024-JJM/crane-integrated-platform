import { useTranslation } from 'react-i18next';
import type { StatusLevel } from '@crane/core/types/status';
import type { Site } from '@crane/domain/region';
import { useSiteRealtimeStats } from '../model/use-site-realtime-stats';
import {
  HoverKpiCell,
  HoverKpiGrid,
  MarkerHoverCardShell,
} from './marker-hover-card-shell';

interface SiteMarkerHoverCardProps {
  site: Site;
  status: StatusLevel;
  visible: boolean;
}

// 핀 박스(38x52) 기준 위쪽에 띄우는 hover summary.
export function SiteMarkerHoverCard({
  site,
  status,
  visible,
}: SiteMarkerHoverCardProps) {
  const { t } = useTranslation();
  const stats = useSiteRealtimeStats(site);

  const displayName = t(site.displayNameKey);
  const country = t(site.countryKey, { defaultValue: '' });
  const statusLabel = t(`common:status.${status}`, { defaultValue: status });

  return (
    <MarkerHoverCardShell
      visible={visible}
      statusLevel={status}
      kicker={t('monitoring-overview:map.marker.siteKicker', {
        defaultValue: 'Site',
      })}
      title={displayName}
      subtitle={country || undefined}
      statusLabel={statusLabel}
      marginBottomClass="mb-3"
    >
      <HoverKpiGrid>
        <HoverKpiCell
          label={t('monitoring-overview:map.marker.cranes', {
            defaultValue: 'Cranes',
          })}
          value={stats.cranes}
          tone="neutral"
        />
        <HoverKpiCell
          label={t('monitoring-overview:map.kpi.warning', {
            defaultValue: 'Warning',
          })}
          value={stats.warning}
          tone="warning"
        />
        <HoverKpiCell
          label={t('monitoring-overview:map.kpi.critical', {
            defaultValue: 'Critical',
          })}
          value={stats.critical}
          tone="critical"
        />
      </HoverKpiGrid>
    </MarkerHoverCardShell>
  );
}
