import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCriticalAlarmNotifier,
  useRegionActiveAlarms,
} from '@crane/features/alarm';
import {
  CollisionGuardHelp,
  CollisionGuardHud,
  CollisionGuardSceneLayer,
  CollisionGuardToggle,
  Monitoring3dView,
} from '@crane/features/3d';
import { getRegionById } from '@crane/domain/region';
import { Spinner } from '@crane/ui/atoms/spinner';

/**
 * 충돌 감지 표시(LiDAR 근접 존)는 필리 조선소 화면에만 둔다. 존은 씬의
 * 골리앗 크레인 배치에서 파생하는데, 옥포 씬에도 같은 자산의 골리앗이
 * 있어 "씬에 크레인이 있으면" 으로는 가르지 못한다 — 사이트로 가른다.
 */
function hasCollisionGuard(regionId: string): boolean {
  return getRegionById(regionId)?.siteType === 'philly-shipyard';
}

function RealtimeMonitoringViewContent({ regionId }: { regionId: string }) {
  const { t } = useTranslation();
  const collisionGuard = hasCollisionGuard(regionId);
  const [is3dViewLoading, setIs3dViewLoading] = useState(true);
  // region 의 활성 알람 → 관제 HUD 의 이상 조건(요약·펼침 목록·위험 비네트).
  // features/alarm 과 features/3d 는 같은 레이어라 페이지가 잇는다.
  const alarms = useRegionActiveAlarms(regionId);
  // 새 critical·high 알람의 소리·브라우저 알림. 화면 표시는 HUD 가 맡는다.
  useCriticalAlarmNotifier(regionId);

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
      {/* 라벨 색은 운전 상태만 나타낸다(`alarmsByCraneId` 를 넘기지 않는다).
          알람은 관제 HUD 의 요약·펼침 목록으로 본다. */}
      <Monitoring3dView
        regionId={regionId}
        mode="realtime"
        alarms={alarms}
        onLoadingChange={setIs3dViewLoading}
        toolbarExtras={
          collisionGuard ? <CollisionGuardToggle regionId={regionId} /> : null
        }
        sceneExtras={
          collisionGuard ? (
            <CollisionGuardSceneLayer regionId={regionId} />
          ) : null
        }
        overlayExtras={
          collisionGuard ? (
            <>
              <CollisionGuardHud regionId={regionId} />
              <CollisionGuardHelp regionId={regionId} />
            </>
          ) : null
        }
      />
    </div>
  );
}

export function RealtimeMonitoringView({ regionId }: { regionId: string }) {
  return <RealtimeMonitoringViewContent key={regionId} regionId={regionId} />;
}
