import { useTranslation } from 'react-i18next';
import type { StatusLevel } from '@crane/core/types/status';
import {
  HoverKpiCell,
  HoverKpiGrid,
  MarkerHoverCardShell,
} from './marker-hover-card-shell';

interface RegionMarkerHoverCardProps {
  visible: boolean;
  statusLevel: StatusLevel;
  label: string;
  subtitle: string;
  statusLabel: string;
  craneCount: number;
  /** 실시간 알람 stats (high + medium 합산) */
  warningCount: number;
  /** 실시간 알람 stats (critical) */
  criticalCount: number;
}

// Region 핀 위쪽에 띄우는 hover summary. SiteMarkerHoverCard와 동일한 HUD shell.
export function RegionMarkerHoverCard({
  visible,
  statusLevel,
  label,
  subtitle,
  statusLabel,
  craneCount,
  warningCount,
  criticalCount,
}: RegionMarkerHoverCardProps) {
  const { t } = useTranslation();

  return (
    <MarkerHoverCardShell
      visible={visible}
      statusLevel={statusLevel}
      kicker={t('monitoring-overview:map.marker.regionKicker', {
        defaultValue: 'Region',
      })}
      title={label}
      subtitle={subtitle || undefined}
      statusLabel={statusLabel}
      marginBottomClass="mb-5"
    >
      <HoverKpiGrid>
        <HoverKpiCell
          label={t('monitoring-overview:map.marker.cranes', {
            defaultValue: 'Cranes',
          })}
          value={craneCount}
          tone="neutral"
        />
        <HoverKpiCell
          label={t('monitoring-overview:map.kpi.warning', {
            defaultValue: 'Warning',
          })}
          value={warningCount}
          tone="warning"
        />
        <HoverKpiCell
          label={t('monitoring-overview:map.kpi.critical', {
            defaultValue: 'Critical',
          })}
          value={criticalCount}
          tone="critical"
        />
      </HoverKpiGrid>
    </MarkerHoverCardShell>
  );
}
