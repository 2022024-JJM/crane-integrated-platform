import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  NavigationProgressContext,
  type ProgressToken,
} from './navigation-progress-state';

const INITIAL_PROGRESS = 0.08;
const MAX_PROGRESS = 0.85;
const COMPLETE_HIDE_DELAY_MS = 180;
const ADVANCE_INTERVAL_MS = 120;

function clampProgress(value: number) {
  return Math.min(MAX_PROGRESS, Math.max(INITIAL_PROGRESS, value));
}

export function NavigationProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const tokenIdRef = useRef(0);
  const activeTokensRef = useRef(new Set<ProgressToken>());
  const navigationTokensRef = useRef(new Set<ProgressToken>());
  const completeTimeoutRef = useRef<number | null>(null);
  const advanceIntervalRef = useRef<number | null>(null);

  const clearCompleteTimeout = useCallback(() => {
    if (completeTimeoutRef.current !== null) {
      window.clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
  }, []);

  const clearAdvanceInterval = useCallback(() => {
    if (advanceIntervalRef.current !== null) {
      window.clearInterval(advanceIntervalRef.current);
      advanceIntervalRef.current = null;
    }
  }, []);

  const scheduleAdvance = useCallback(() => {
    clearAdvanceInterval();
    advanceIntervalRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= MAX_PROGRESS) {
          return current;
        }

        const remaining = MAX_PROGRESS - current;
        const step = Math.max(remaining * 0.18, 0.015);
        return clampProgress(current + step);
      });
    }, ADVANCE_INTERVAL_MS);
  }, [clearAdvanceInterval]);

  const finishIfIdle = useCallback(() => {
    if (activeTokensRef.current.size > 0) {
      return;
    }

    clearAdvanceInterval();
    clearCompleteTimeout();
    setProgress(1);
    completeTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      setProgress(0);
      completeTimeoutRef.current = null;
    }, COMPLETE_HIDE_DELAY_MS);
  }, [clearAdvanceInterval, clearCompleteTimeout]);

  const start = useCallback(() => {
    clearCompleteTimeout();
    const token = ++tokenIdRef.current;
    activeTokensRef.current.add(token);

    setIsVisible(true);
    setProgress((current) => {
      if (current <= 0 || current >= 1) {
        return INITIAL_PROGRESS;
      }

      return clampProgress(Math.max(current, INITIAL_PROGRESS));
    });

    scheduleAdvance();
    return token;
  }, [clearCompleteTimeout, scheduleAdvance]);

  const advance = useCallback((value?: number) => {
    setProgress((current) => {
      if (current <= 0) {
        return value !== undefined ? clampProgress(value) : INITIAL_PROGRESS;
      }

      if (value !== undefined) {
        return clampProgress(Math.max(current, value));
      }

      return clampProgress(current + 0.08);
    });
  }, []);

  const complete = useCallback(
    (token?: ProgressToken) => {
      if (typeof token === 'number') {
        activeTokensRef.current.delete(token);
        navigationTokensRef.current.delete(token);
      } else {
        activeTokensRef.current.clear();
        navigationTokensRef.current.clear();
      }

      finishIfIdle();
    },
    [finishIfIdle],
  );

  const reset = useCallback(() => {
    activeTokensRef.current.clear();
    navigationTokensRef.current.clear();
    clearAdvanceInterval();
    clearCompleteTimeout();
    setIsVisible(false);
    setProgress(0);
  }, [clearAdvanceInterval, clearCompleteTimeout]);

  const startNavigation = useCallback(() => {
    const token = start();
    navigationTokensRef.current.add(token);
  }, [start]);

  const completeNavigation = useCallback(() => {
    if (navigationTokensRef.current.size === 0) {
      return;
    }

    for (const token of navigationTokensRef.current) {
      activeTokensRef.current.delete(token);
    }
    navigationTokensRef.current.clear();

    finishIfIdle();
  }, [finishIfIdle]);

  useEffect(() => {
    return () => {
      clearAdvanceInterval();
      clearCompleteTimeout();
    };
  }, [clearAdvanceInterval, clearCompleteTimeout]);

  return (
    <NavigationProgressContext.Provider
      value={{
        isVisible,
        progress,
        start,
        advance,
        complete,
        reset,
        startNavigation,
        completeNavigation,
      }}
    >
      {children}
    </NavigationProgressContext.Provider>
  );
}
