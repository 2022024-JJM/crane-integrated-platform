import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Replay3dView } from '@crane/features/3d';
import { useMonitoringReplayUiState } from '@crane/features/monitoring';
import { Spinner } from '@crane/ui/atoms/spinner';

function ReplayMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);
  const search = useMonitoringReplayUiState(regionId);

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
      <Replay3dView
        regionId={regionId}
        onLoadingChange={setIs3dViewLoading}
        search={search}
      />
    </div>
  );
}

export function ReplayMonitoringView({ regionId }: { regionId: string }) {
  return <ReplayMonitoringViewContent key={regionId} regionId={regionId} />;
}
