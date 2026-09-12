import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Alarm, AlarmSeverity } from '@crane/domain/alarm';
import { getCraneIdsByRegion } from '@crane/domain/crane';
import { notifyAlert } from '@crane/core/lib/alert-notifications';
import {
  isAlarmInRegion,
  useRealtimeAlarmStore,
} from './use-realtime-alarm-store';

const AUTO_DISMISS_MS = 5000;

// critical을 high보다 우선해 동시에 새로 발생하면 critical을 먼저 띄운다.
const SEVERITY_RANK: Record<AlarmSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

/**
 * 배너 대상 — critical·high. 영역 침범 로컬 알람은 제외한다: 3D 화면이 자체
 * 경보 배너(SceneZoneAlertOverlay)를 띄우므로 같은 사건이 두 배너로 겹친다.
 */
function shouldNotifyForBanner(alarm: Alarm) {
  return (
    (alarm.severity === 'critical' || alarm.severity === 'high') &&
    alarm.eventType !== 'zone_intrusion'
  );
}

export interface CriticalAlarmBannerState {
  alarm: Alarm | null;
  dismiss: () => void;
}

export function useCriticalAlarmBanner(
  regionId: string,
): CriticalAlarmBannerState {
  const activeAlarms = useRealtimeAlarmStore((s) => s.activeAlarms);

  const [alarm, setAlarm] = useState<Alarm | null>(null);

  // 최초 마운트 시점에 이미 활성 상태인 알람은 배너로 띄우지 않는다
  // ('새로 발생'이 아니라 '복원'이므로 사용자 주의를 강제할 필요 없음).
  const seenIdsRef = useRef<Set<string> | null>(null);
  const timerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setAlarm(null);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const allowedCraneIdsRef = useMemo(
    () => new Set(getCraneIdsByRegion(regionId)),
    [regionId],
  );

  useEffect(() => {
    const currentIds = new Set<string>();
    let bannerCandidate: Alarm | null = null;

    for (const candidate of Object.values(activeAlarms)) {
      if (
        !isAlarmInRegion(candidate, regionId, allowedCraneIdsRef) ||
        !candidate.active ||
        !shouldNotifyForBanner(candidate)
      ) {
        continue;
      }
      currentIds.add(candidate.id);
    }

    if (seenIdsRef.current === null) {
      seenIdsRef.current = currentIds;
      return;
    }

    const seen = seenIdsRef.current;
    for (const candidate of Object.values(activeAlarms)) {
      if (
        !isAlarmInRegion(candidate, regionId, allowedCraneIdsRef) ||
        !candidate.active ||
        !shouldNotifyForBanner(candidate) ||
        seen.has(candidate.id)
      ) {
        continue;
      }
      if (bannerCandidate === null) {
        bannerCandidate = candidate;
        continue;
      }
      // severity 우선 (critical > high), 같으면 더 최근 것 우선.
      const severityDiff =
        SEVERITY_RANK[candidate.severity] -
        SEVERITY_RANK[bannerCandidate.severity];
      if (severityDiff < 0) {
        bannerCandidate = candidate;
      } else if (
        severityDiff === 0 &&
        candidate.timestamp.localeCompare(bannerCandidate.timestamp) > 0
      ) {
        bannerCandidate = candidate;
      }
    }

    seenIdsRef.current = currentIds;

    if (bannerCandidate === null) {
      return;
    }

    setAlarm(bannerCandidate);
    // 배너 밖 채널(소리·브라우저 알림). toast 는 배너가 이미 화면을 차지해
    // 띄우지 않는다.
    notifyAlert({
      id: `alarm:${bannerCandidate.id}`,
      severity:
        bannerCandidate.severity === 'critical' ? 'critical' : 'warning',
      title: `${bannerCandidate.craneName} — ${bannerCandidate.alarmName ?? bannerCandidate.eventType}`,
      description: bannerCandidate.alarmDescription ?? undefined,
      toast: false,
    });

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setAlarm(null);
      timerRef.current = null;
    }, AUTO_DISMISS_MS);
  }, [activeAlarms, regionId, allowedCraneIdsRef]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { alarm, dismiss };
}
