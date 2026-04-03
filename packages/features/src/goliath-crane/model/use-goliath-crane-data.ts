import { useState, useEffect, useCallback } from 'react';
import {
  type GoliathCraneDetail,
  type GoliathSensorTimeSeries,
  type GoliathSafetyParameter,
  type GoliathOperationLogEntry,
  type TimeRange,
  getGoliathCrane,
  applyLiveFluctuation,
  generateSensorHistory,
  getGoliathSafetyParameters,
  getGoliathOperationLog,
} from '@crane/domain/goliath-crane';

const LIVE_INTERVAL_MS = 2_000;

export function useGoliathCraneData() {
  const baseCrane = getGoliathCrane();
  const [crane, setCrane] = useState<GoliathCraneDetail>(baseCrane);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [sensorHistory, setSensorHistory] = useState<GoliathSensorTimeSeries[]>(
    () => generateSensorHistory(baseCrane, '1h'),
  );
  const [safetyParams, setSafetyParams] = useState<GoliathSafetyParameter[]>(
    () => getGoliathSafetyParameters(baseCrane),
  );
  const [operationLog] = useState<GoliathOperationLogEntry[]>(
    getGoliathOperationLog,
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCrane((prev) => {
        const updated = applyLiveFluctuation(prev);
        setSafetyParams(getGoliathSafetyParameters(updated));
        setSensorHistory((prevHistory) => {
          const newPoint: GoliathSensorTimeSeries = {
            timestamp: new Date().toISOString(),
            load: updated.load,
            windSpeed: updated.windSpeed,
            hoistHeight: updated.hoistHeight,
          };
          const maxPoints = 200;
          const next = [...prevHistory, newPoint];
          return next.length > maxPoints
            ? next.slice(next.length - maxPoints)
            : next;
        });
        return updated;
      });
    }, LIVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const changeTimeRange = useCallback(
    (range: TimeRange) => {
      setTimeRange(range);
      setSensorHistory(generateSensorHistory(crane, range));
    },
    [crane],
  );

  return {
    crane,
    sensorHistory,
    safetyParams,
    operationLog,
    timeRange,
    setTimeRange: changeTimeRange,
  };
}
