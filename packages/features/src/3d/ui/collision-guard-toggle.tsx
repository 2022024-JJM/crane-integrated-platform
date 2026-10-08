import { Radar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import {
  SCENE_TOOLBAR_BUTTON_CLASS,
  SCENE_TOOLBAR_DISABLED_CLASS,
} from '@crane/ui/molecules/scene-toolbar-button';
import { cn } from '@crane/core/lib/utils';
import { useCollisionGuardStore } from '../model/use-collision-guard-store';
import { useSceneSplitStore } from '../model/use-scene-split-store';
import { useGoliathCollisionZones } from '../model/use-goliath-collision-zones';

/**
 * 충돌 감지 표시 토글 — Monitoring3dView 의 toolbarExtras 슬롯(DOM).
 *
 * 씬에 골리앗 크레인이 없으면(존을 파생할 수 없으면) 버튼을 두지 않는다 —
 * 켜도 아무것도 그려지지 않는 버튼은 고장으로 읽힌다.
 */
export function CollisionGuardToggle({ regionId }: { regionId: string }) {
  const { t } = useTranslation('monitoring');
  const enabled = useCollisionGuardStore((s) => s.enabled);
  const toggle = useCollisionGuardStore((s) => s.toggle);
  const derived = useGoliathCollisionZones(regionId);
  // 분할 화면 중엔 비활성 — 가드 카메라 리그가 기본 카메라를 움직이는데
  // 분할에서는 그 카메라가 보이지 않는다(독 레일 규칙).
  const splitActive = useSceneSplitStore((s) => s.activeKey !== null);

  if (!derived) return null;

  const label = splitActive
    ? t('sceneSplit.disabledInSplit')
    : enabled
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
            aria-disabled={splitActive || undefined}
            className={cn(
              SCENE_TOOLBAR_BUTTON_CLASS,
              enabled &&
                'border-sky-500/60 bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-400',
              splitActive && SCENE_TOOLBAR_DISABLED_CLASS,
            )}
          />
        }
        onClick={() => {
          if (splitActive) return;
          toggle();
        }}
      >
        <Radar />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
