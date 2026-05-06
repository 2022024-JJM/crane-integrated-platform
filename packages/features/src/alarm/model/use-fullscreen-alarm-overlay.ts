import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Alarm } from '@crane/domain/alarm';
import { getCraneIdsByRegion } from '@crane/domain/crane';
import { useRealtimeAlarmStore } from './use-realtime-alarm-store';

const STORAGE_KEY = 'crane:alarm-fullscreen-overlay:visible';

function readInitialVisible(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw === '1';
  } catch {
    return true;
  }
}

function persistVisible(visible: boolean) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, visible ? '1' : '0');
  } catch {
    // storage 접근 실패는 무시 (UX 비핵심)
  }
}

function selectRegionActiveAlarms(
  activeAlarms: Record<string, Alarm>,
  regionId: string,
): Alarm[] {
  const allowedCraneIds = new Set(getCraneIdsByRegion(regionId));
  const result: Alarm[] = [];
  for (const alarm of Object.values(activeAlarms)) {
    if (allowedCraneIds.has(alarm.craneId) && alarm.active) {
      result.push(alarm);
    }
  }
  return result;
}

export interface FullscreenAlarmOverlayState {
  visible: boolean;
  toggle: () => void;
  setVisible: (next: boolean) => void;
  activeAlarmCount: number;
}

export function useFullscreenAlarmOverlay(
  regionId: string,
): FullscreenAlarmOverlayState {
  const activeAlarms = useRealtimeAlarmStore((s) => s.activeAlarms);

  const regionAlarms = useMemo(
    () => selectRegionActiveAlarms(activeAlarms, regionId),
    [activeAlarms, regionId],
  );
  const activeAlarmCount = regionAlarms.length;

  const [visible, setVisibleState] = useState<boolean>(readInitialVisible);

  const setVisible = useCallback((next: boolean) => {
    setVisibleState(next);
    persistVisible(next);
  }, []);

  const toggle = useCallback(() => {
    setVisibleState((prev) => {
      const next = !prev;
      persistVisible(next);
      return next;
    });
  }, []);

  const prevCountRef = useRef(activeAlarmCount);
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = activeAlarmCount;

    if (prev === 0 && activeAlarmCount > 0) {
      setVisibleState(true);
      persistVisible(true);
    }
  }, [activeAlarmCount]);

  return { visible, toggle, setVisible, activeAlarmCount };
}
