import { startTransition, useEffect, useMemo, useState } from 'react';

import { buildDashboardSummary } from './build-dashboard-summary';

export function useDashboardSummary() {
  const summary = useMemo(() => buildDashboardSummary(), []);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) {
        return;
      }

      startTransition(() => {
        setIsLoading(false);
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, isLoading };
}
