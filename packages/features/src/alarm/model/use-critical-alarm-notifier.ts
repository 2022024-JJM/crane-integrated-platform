import { useEffect, useMemo, useRef } from 'react';
import type { Alarm, AlarmSeverity } from '@crane/domain/alarm';
import { getCraneIdsByRegion } from '@crane/domain/crane';
import { notifyAlert } from '@crane/core/lib/alert-notifications';
import {
  isAlarmInRegion,
  useRealtimeAlarmStore,
} from './use-realtime-alarm-store';

// 같은 tick 에 여럿이 새로 생기면 critical 을 high 보다 먼저 알린다.
const SEVERITY_RANK: Record<AlarmSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

/**
 * 알림 대상 — critical·high. 영역 침범 로컬 알람은 제외한다: 3D 화면 경보
 * (features/3d scene-alert-notifier)가 같은 사건을 이미 울린다.
 */
function shouldNotify(alarm: Alarm): boolean {
  return (
    (alarm.severity === 'critical' || alarm.severity === 'high') &&
    alarm.eventType !== 'zone_intrusion'
  );
}

function isMoreUrgent(candidate: Alarm, than: Alarm): boolean {
  const diff = SEVERITY_RANK[candidate.severity] - SEVERITY_RANK[than.severity];
  if (diff !== 0) return diff < 0;
  return candidate.timestamp.localeCompare(than.timestamp) > 0;
}

/**
 * 새 critical·high 알람의 소리·브라우저 알림 — 실시간 모니터링 페이지가
 * 부른다. 화면 표시(요약·펼침 목록·위험 비네트)는 3D 관제 HUD 가 맡으므로
 * toast 도 배너도 띄우지 않는다(`notifyAlert` 의 채널 설정은
 * `@crane/core/lib/alert-notifications`).
 *
 * 최초 마운트 시점에 이미 활성인 알람은 '새로 발생'이 아니라 '복원'이라
 * 알리지 않는다. 같은 변화에 여럿이 새로 생기면 critical 을 high 보다,
 * 같으면 더 최근 것 하나만 알린다.
 */
export function useCriticalAlarmNotifier(regionId: string): void {
  const activeAlarms = useRealtimeAlarmStore((s) => s.activeAlarms);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const allowedCraneIds = useMemo(
    () => new Set(getCraneIdsByRegion(regionId)),
    [regionId],
  );

  useEffect(() => {
    const currentIds = new Set<string>();
    const candidates: Alarm[] = [];
    for (const alarm of Object.values(activeAlarms)) {
      if (
        !isAlarmInRegion(alarm, regionId, allowedCraneIds) ||
        !alarm.active ||
        !shouldNotify(alarm)
      ) {
        continue;
      }
      currentIds.add(alarm.id);
      candidates.push(alarm);
    }
    const seen = seenIdsRef.current;
    seenIdsRef.current = currentIds;
    if (seen === null) return;

    let pick: Alarm | null = null;
    for (const alarm of candidates) {
      if (seen.has(alarm.id)) continue;
      if (pick === null || isMoreUrgent(alarm, pick)) pick = alarm;
    }
    if (pick === null) return;
    notifyAlert({
      id: `alarm:${pick.id}`,
      severity: pick.severity === 'critical' ? 'critical' : 'warning',
      title: `${pick.craneName} — ${pick.alarmName ?? pick.eventType}`,
      description: pick.alarmDescription ?? undefined,
      toast: false,
    });
  }, [activeAlarms, regionId, allowedCraneIds]);
}
