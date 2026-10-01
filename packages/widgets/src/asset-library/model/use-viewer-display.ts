import { useCallback, useState } from 'react';
import { useTheme } from '@crane/core/lib/theme-context';
import {
  createViewerDisplay,
  type ViewerDisplay,
} from '../lib/viewer-display-state';

/**
 * 뷰어 표시 상태. 첫 배경은 앱 테마를 따른다. `initial` 은 처음 한 번만 읽는다.
 */
export function useViewerDisplay(initial?: Partial<ViewerDisplay>) {
  const { theme } = useTheme();
  const [display, setState] = useState<ViewerDisplay>(() => ({
    ...createViewerDisplay(theme),
    ...initial,
  }));
  const setDisplay = useCallback((patch: Partial<ViewerDisplay>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);
  return { display, setDisplay };
}
