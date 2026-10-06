import { useState, useEffect } from 'react';
import {
  type GoliathCraneDetail,
  getGoliathCrane,
  applyLiveFluctuation,
} from '@crane/domain/goliath-crane';

const LIVE_INTERVAL_MS = 2_000;

export function useGoliathCraneData() {
  const [crane, setCrane] = useState<GoliathCraneDetail>(getGoliathCrane);

  useEffect(() => {
    const interval = setInterval(() => {
      setCrane((prev) => applyLiveFluctuation(prev));
    }, LIVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return { crane };
}
