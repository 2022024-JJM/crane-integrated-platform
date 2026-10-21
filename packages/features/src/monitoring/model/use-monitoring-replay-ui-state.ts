import type { MonitoringReplayUiState } from '@crane/domain/monitoring';
import { useMonitoringReplaySearch } from './use-monitoring-replay-search';
import { useMonitoringReplayPlayer } from './use-monitoring-replay-player';

export function useMonitoringReplayUiState(
  regionId: string,
): MonitoringReplayUiState {
  const search = useMonitoringReplaySearch(regionId);
  const player = useMonitoringReplayPlayer({
    regionId,
    from: search.query.from,
    to: search.query.to,
  });

  return {
    draftStart: search.draftStart,
    setDraftStart: search.setDraftStart,
    resetDraftStart: search.resetDraftStart,
    draftEnd: search.draftEnd,
    duration: search.duration,
    setDuration: search.setDuration,
    durations: search.durations,
    submitSearch: search.submitSearch,
    canSearch: search.canSearch,
    validationReason: search.validationReason,
    viewingFrom: search.viewingFrom,
    viewingTo: search.viewingTo,
    isLoading: player.isLoading,
    isError: player.isError,
    isEmpty: player.isEmpty,
    errorMessage: player.errorMessage,
  };
}
