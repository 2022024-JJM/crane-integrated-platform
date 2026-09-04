import { useTranslation } from 'react-i18next';
import type { StatusLevel } from '@crane/core/types/status';
import { getRegionIdentity } from '../lib/marker-identity';
import {
  HoverKpiCell,
  HoverKpiGrid,
  MarkerHoverCardShell,
} from './marker-hover-card-shell';
import { MarkerIdentityChip } from './marker-identity-chip';

interface RegionMarkerHoverCardProps {
  visible: boolean;
  statusLevel: StatusLevel;
  regionId: string;
  /** 마커 플레이트와 같은 도크 코드 (D1 · IN · GC) */
  shortCode: string;
  label: string;
  subtitle: string;
  statusLabel: string;
  craneCount: number;
  /** 실시간 알람 stats (high + medium 합산) */
  warningCount: number;
  /** 실시간 알람 stats (critical) */
  criticalCount: number;
}

// Region 마커 위쪽에 띄우는 hover summary. SiteMarkerHoverCard와 동일한 HUD shell.
export function RegionMarkerHoverCard({
  visible,
  statusLevel,
  regionId,
  shortCode,
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
      title={label}
      subtitle={subtitle || undefined}
      statusLabel={statusLabel}
      category={t('monitoring-overview:map.marker.regionCategory')}
      actionHint={t('monitoring-overview:map.marker.enterRegion')}
      leadingBadge={
        <MarkerIdentityChip identity={getRegionIdentity(regionId)}>
          {shortCode}
        </MarkerIdentityChip>
      }
    >
      <HoverKpiGrid>
        <HoverKpiCell
          label={t('monitoring-overview:map.marker.cranes')}
          value={craneCount}
          tone="neutral"
        />
        <HoverKpiCell
          label={t('monitoring-overview:map.kpi.warning')}
          value={warningCount}
          tone="warning"
        />
        <HoverKpiCell
          label={t('monitoring-overview:map.kpi.critical')}
          value={criticalCount}
          tone="critical"
        />
      </HoverKpiGrid>
    </MarkerHoverCardShell>
  );
}
