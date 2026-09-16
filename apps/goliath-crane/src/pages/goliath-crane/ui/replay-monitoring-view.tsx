import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlaybackReportPanel, PlaybackView } from '@crane/features/3d';
import { useMonitoringReplayUiState } from '@crane/features/monitoring';
import { Spinner } from '@crane/ui/atoms/spinner';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@crane/ui/molecules/resizable';

/**
 * 플레이백(분석) 페이지 — 기록 리플레이 | 시뮬레이션을 한 3D 뷰에서 재생하고
 * 우측에 실행 리포트를 둔다. 소스 전환은 PlaybackView 안의 상태 전환이라
 * 이 컴포넌트(검색 상태 소유)는 리마운트되지 않는다.
 */
function ReplayMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);
  const search = useMonitoringReplayUiState(regionId);

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0">
      <ResizablePanel defaultSize={74} minSize={50}>
        <div className="relative h-full min-h-0 w-full">
          {is3dViewLoading ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
              <Spinner className="size-6 text-orange-500" aria-hidden="true" />
              <p className="text-sm font-medium text-white">
                {t('common:viewer3d.loading')}
              </p>
            </div>
          ) : null}
          <PlaybackView
            regionId={regionId}
            onLoadingChange={setIs3dViewLoading}
            search={search}
          />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={26} minSize={18}>
        <PlaybackReportPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function ReplayMonitoringView({ regionId }: { regionId: string }) {
  return <ReplayMonitoringViewContent key={regionId} regionId={regionId} />;
}
