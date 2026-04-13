import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Replay3dView, ReplaySearchForm } from '@crane/features/3d';
import {
  useMonitoringReplaySearch,
  useMonitoringReplayPlayer,
} from '@crane/features/monitoring';
import { Spinner } from '@crane/ui/atoms/spinner';

function ReplayMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);

  const {
    draftFrom,
    draftTo,
    setDraftFrom,
    setDraftTo,
    submitSearch,
    canSearch,
    validationReason,
    query,
  } = useMonitoringReplaySearch(regionId);

  const { isLoading, isError, errorMessage } = useMonitoringReplayPlayer({
    regionId,
    from: query.from,
    to: query.to,
  });

  return (
    <div className="relative h-full min-h-0 w-full">
      {is3dViewLoading ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
          <Spinner className="size-6 text-orange-500" aria-hidden="true" />
          <p className="text-sm font-medium text-white">
            {t('common:viewer3d.loading')}
          </p>
        </div>
      ) : null}
      <Replay3dView regionId={regionId} onLoadingChange={setIs3dViewLoading} />
      {!is3dViewLoading ? (
        <ReplaySearchForm
          draftFrom={draftFrom}
          draftTo={draftTo}
          onDraftFromChange={setDraftFrom}
          onDraftToChange={setDraftTo}
          onSearch={submitSearch}
          canSearch={canSearch}
          validationReason={validationReason}
          isLoading={isLoading}
          isError={isError}
          errorMessage={errorMessage}
          className="pointer-events-auto absolute top-3 left-3 z-10 w-72"
        />
      ) : null}
    </div>
  );
}

export function ReplayMonitoringView({ regionId }: { regionId: string }) {
  return <ReplayMonitoringViewContent key={regionId} regionId={regionId} />;
}
