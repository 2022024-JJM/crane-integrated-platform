import { startTransition, useEffect, useMemo, useState } from 'react';

import { useSiteType } from '@crane/core/lib/site-type-context';
import { buildDashboardSummary } from './build-dashboard-summary';

export function useDashboardSummary() {
  const { siteType } = useSiteType();
  const summary = useMemo(() => buildDashboardSummary(siteType), [siteType]);
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
