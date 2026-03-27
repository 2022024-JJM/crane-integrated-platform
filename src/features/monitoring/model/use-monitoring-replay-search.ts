import { useCallback, useMemo, useState } from 'react';

import {
  buildDefaultReplayFormValues,
  fromDateTimeLocalValue,
  validateReplayDateTimeRange,
} from '@/entities/monitoring';

export function useMonitoringReplaySearch(regionId: string) {
  const defaults = useMemo(() => buildDefaultReplayFormValues(regionId), [regionId]);
  const [draftFrom, setDraftFrom] = useState(defaults.from);
  const [draftTo, setDraftTo] = useState(defaults.to);
  const [submittedRange, setSubmittedRange] = useState({
    from: defaults.from,
    to: defaults.to,
    interval: defaults.interval,
  });

  const validation = useMemo(
    () => validateReplayDateTimeRange(draftFrom, draftTo),
    [draftFrom, draftTo],
  );
  const canSearch = validation.isValid;

  const query = useMemo(
    () => ({
      from: fromDateTimeLocalValue(submittedRange.from),
      to: fromDateTimeLocalValue(submittedRange.to),
      interval: submittedRange.interval,
    }),
    [submittedRange.from, submittedRange.interval, submittedRange.to],
  );

  const submitSearch = useCallback(() => {
    if (!canSearch) {
      return;
    }

    setSubmittedRange((current) => ({
      ...current,
      from: draftFrom,
      to: draftTo,
    }));
  }, [canSearch, draftFrom, draftTo]);

  return {
    draftFrom,
    draftTo,
    setDraftFrom,
    setDraftTo,
    submitSearch,
    canSearch,
    validationReason: validation.reason,
    viewingFrom: submittedRange.from,
    viewingTo: submittedRange.to,
    interval: submittedRange.interval,
    query,
  };
}
