import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCriticalAlarmNotifier,
  useRegionActiveAlarms,
  useRegionActiveAlarmsByCraneId,
} from '@crane/features/alarm';
import { Monitoring3dView } from '@crane/features/3d';
import { Spinner } from '@crane/ui/atoms/spinner';

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  // 라벨 배경·미니맵 마커의 알람 색.
  const alarmsByCraneId = useRegionActiveAlarmsByCraneId(regionId);
  // region 의 활성 알람 → 관제 HUD 의 이상 조건(요약·펼침 목록·위험 비네트).
  // features/alarm 과 features/3d 는 같은 레이어라 페이지가 잇는다.
  const alarms = useRegionActiveAlarms(regionId);
  // 새 critical·high 알람의 소리·브라우저 알림. 화면 표시는 HUD 가 맡는다.
  useCriticalAlarmNotifier(regionId);
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);

  return (
    <div className="relative h-full min-h-0">
      {is3dViewLoading ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
          <Spinner className="size-6 text-orange-500" aria-hidden="true" />
          <p className="text-sm font-medium text-white">
            {t('common:viewer3d.loading')}
          </p>
        </div>
      ) : null}
      <Monitoring3dView
        regionId={regionId}
        alarmsByCraneId={alarmsByCraneId}
        alarms={alarms}
        alarmHighlightMesh
        mode="realtime"
        onLoadingChange={setIs3dViewLoading}
      />
    </div>
  );
}

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewContent key={regionId} regionId={regionId} />;
}
