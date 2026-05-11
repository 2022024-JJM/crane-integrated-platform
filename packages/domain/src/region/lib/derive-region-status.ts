import type { AlarmStatistics } from '@crane/domain/alarm';
import type { StatusLevel } from '../model/types';

/**
 * 실시간 알람 통계에서 region 표현용 StatusLevel을 유도한다.
 * - critical 알람이 1개라도 있으면 critical
 * - high 또는 medium 알람이 있으면 warning
 * - 그 외 (info만 있거나 비어있음) normal
 *
 * 도크 카드와 지도 마커가 동일한 selector를 통해 색상을 결정하도록 도메인에 둔다.
 */
export function deriveRegionStatus(stats: AlarmStatistics): StatusLevel {
  if (stats.critical > 0) return 'critical';
  if (stats.high > 0 || stats.medium > 0) return 'warning';
  return 'normal';
}
