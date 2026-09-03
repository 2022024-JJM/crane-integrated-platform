import { Radar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  CollisionGuard,
  CollisionGuardCameraRig,
  useCollisionGuardStore,
} from '@crane/features/3d';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/molecules/scene-toolbar-button';
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
      {/* 에고 프레이밍: 토글 ON에 크레인 중심 상공으로 날아가고, OFF에
          진입 직전 시점으로 되돌아온다. 카메라 조작으로 인한 자동 진입은
          두지 않는다 — 토글이 유일한 트리거라야 복귀 지점이 명확하다. */}
      <CollisionGuardCameraRig pose={derived.egoTopPose} duration={0.9} />
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
              SCENE_TOOLBAR_BUTTON_CLASS,
              enabled &&
                'border-sky-500/60 bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-400',
            )}
          />
        }
        onClick={toggle}
      >
        <Radar />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
