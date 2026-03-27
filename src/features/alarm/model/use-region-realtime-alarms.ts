import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  getRealtimeAlarmHistoryByRegion,
  getRealtimeAlarmStatsByRegion,
  useRealtimeAlarmStore,
} from './use-realtime-alarm-store';

export function useRegionRealtimeAlarms(regionId: string) {
  const { activeAlarms, history } = useRealtimeAlarmStore(
    useShallow((state) => ({
      activeAlarms: state.activeAlarms,
      history: state.history,
    })),
  );

  return useMemo(
    () => ({
      stats: getRealtimeAlarmStatsByRegion(activeAlarms, regionId),
      alarms: getRealtimeAlarmHistoryByRegion(history, regionId),
    }),
    [activeAlarms, history, regionId],
  );
}
