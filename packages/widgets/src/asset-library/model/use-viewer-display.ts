import { useCallback, useState } from 'react';
import { useTheme } from '@crane/core/lib/theme-context';
import {
  createViewerDisplay,
  readRememberedViewerDisplay,
  rememberViewerDisplay,
  type ViewerDisplay,
} from '../lib/viewer-display-state';

/**
 * 뷰어 표시 상태. 이 탭에서 마지막으로 고른 값으로 시작하고, 배경을 고른 적이
 * 없으면 앱 테마를 따른다. 기억해 둔 값은 마운트할 때 한 번만 읽는다.
 */
export function useViewerDisplay() {
  const { theme } = useTheme();
  const [display, setState] = useState<ViewerDisplay>(() => ({
    ...createViewerDisplay(theme),
    ...readRememberedViewerDisplay(),
  }));
  const setDisplay = useCallback((patch: Partial<ViewerDisplay>) => {
    setState((current) => ({ ...current, ...patch }));
    rememberViewerDisplay(patch);
  }, []);
  return { display, setDisplay };
}
