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
    draftFrom: search.draftFrom,
    draftTo: search.draftTo,
    setDraftFrom: search.setDraftFrom,
    setDraftTo: search.setDraftTo,
    submitSearch: search.submitSearch,
    canSearch: search.canSearch,
    validationReason: search.validationReason,
    viewingFrom: search.viewingFrom,
    viewingTo: search.viewingTo,
    isLoading: player.isLoading,
    isError: player.isError,
    errorMessage: player.errorMessage,
  };
}
