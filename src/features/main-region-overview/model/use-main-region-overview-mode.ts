import { useCallback, useState } from 'react';

export const regionViewModeVariants = ['card', 'map'] as const;

export type RegionViewMode = (typeof regionViewModeVariants)[number];
export type RegionMode = RegionViewMode;

export function useMainRegionOverviewMode(
  initialMode: RegionViewMode = 'card',
) {
  const [mode, setMode] = useState<RegionMode>(initialMode);

  const setRegionViewMode = useCallback((nextMode: RegionMode) => {
    setMode(nextMode);
  }, []);

  return {
    mode,
    setMode: setRegionViewMode,
  };
}
