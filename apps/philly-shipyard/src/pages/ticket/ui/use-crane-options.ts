import { useMemo } from 'react';
import { getAllCraneAssets } from '@crane/domain/asset';

export function useCraneOptions() {
  return useMemo(() => getAllCraneAssets(), []);
}
