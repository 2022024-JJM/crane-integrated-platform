import { useMemo, useRef } from 'react';
import type { AlarmSeverity } from '@crane/domain/alarm';
import { useRealtimeAlarmStore } from './use-realtime-alarm-store';

const SEVERITY_ORDER: AlarmSeverity[] = ['critical', 'high', 'medium', 'info'];

function shallowEqualRecord(
  a: Record<string, AlarmSeverity>,
  b: Record<string, AlarmSeverity>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function useRegionActiveAlarmsByCraneId(regionId: string): Record<string, AlarmSeverity> {
  const activeAlarms = useRealtimeAlarmStore((s) => s.activeAlarms);
  const prevRef = useRef<Record<string, AlarmSeverity>>({});

  return useMemo(() => {
    const result: Record<string, AlarmSeverity> = {};

    for (const alarm of Object.values(activeAlarms)) {
      if (alarm.regionId !== regionId || !alarm.active) {
        continue;
      }

      const current = result[alarm.craneId];
      const isHigher =
        !current ||
        SEVERITY_ORDER.indexOf(alarm.severity) < SEVERITY_ORDER.indexOf(current);

      if (isHigher) {
        result[alarm.craneId] = alarm.severity;
      }
    }

    if (shallowEqualRecord(prevRef.current, result)) {
      return prevRef.current;
    }

    prevRef.current = result;
    return result;
  }, [activeAlarms, regionId]);
}
