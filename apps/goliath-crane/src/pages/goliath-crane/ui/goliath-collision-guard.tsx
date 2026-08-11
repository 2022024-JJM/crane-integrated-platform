import { Radar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  CollisionGuard,
  CollisionGuardCameraRig,
  CollisionGuardTopViewSync,
  useCollisionGuardStore,
} from '@crane/features/3d';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { cn } from '@crane/core/lib/utils';
import { useGoliathCollisionZones } from '../model/use-goliath-collision-zones';

/** Monitoring3dView의 sceneExtras 슬롯에 넣는 씬 레이어 (Canvas 내부) */
export function GoliathCollisionGuardScene() {
  // 씬의 크레인 배치에서 파생 — 크레인이 이동하면 존도 따라온다.
  const derived = useGoliathCollisionZones();

  if (!derived) return null;

  return (
    <>
      <CollisionGuard zones={derived.zones} />
      {/* 탑뷰 진입 시 자동 ON, 이탈 시 자동 OFF */}
      <CollisionGuardTopViewSync />
      {/* 에고 프레이밍: 탑뷰 진입(=가드 ON) 시 크레인 중심 상공으로
          자동 프레이밍. 이탈은 사용자 카메라 조작이 트리거이므로 복귀
          플라이트는 하지 않는다. */}
      <CollisionGuardCameraRig
        pose={derived.egoTopPose}
        duration={0.9}
        restoreOnDisable={false}
      />
    </>
  );
}

/** Monitoring3dView의 toolbarExtras 슬롯에 넣는 토글 버튼 (DOM) */
export function GoliathCollisionGuardToggle() {
  const { t } = useTranslation('goliath-crane');
  const enabled = useCollisionGuardStore((s) => s.enabled);
  const toggle = useCollisionGuardStore((s) => s.toggle);

  const label = enabled
    ? t('collisionGuard.disable')
    : t('collisionGuard.enable');

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={label}
            aria-pressed={enabled}
            className={cn(
              'bg-background/85 border-border/70 shadow-sm backdrop-blur-sm',
              enabled &&
                'border-sky-500/60 bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-400',
            )}
          />
        }
        onClick={toggle}
      >
        <Radar />
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
