import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from '@crane/ui/molecules/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/molecules/scene-toolbar-button';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import {
  SceneCollisionPanel,
  type SceneCollisionRunner,
} from './scene-collision-panel';

interface SceneCollisionMenuProps {
  onViewCollision: () => void;
  runner: SceneCollisionRunner;
}

/**
 * 충돌 감지 팝업 — 모니터링 독 우측 레일용 아이콘 버튼(SceneSimulationToggle
 * 과 같은 형태). 누르면 에디터 "충돌" 탭과 같은 패널(SceneCollisionPanel)이
 * 왼쪽으로 열린다. 레일에선 버튼 배경이 평면화되므로 감지 켜짐(amber)·충돌
 * 정지(red)는 테두리·글자색으로 구분한다.
 *
 * PopoverTrigger 가 붙이는 data-popup-open 을 독 레일이 세어 팝업이 열린
 * 동안 접히지 않는다(scene-dock.tsx) — 커스텀 포털을 쓰지 않는 이유.
 * TooltipProvider 는 ThreeSceneViewer 가 감싸고 있어 여기서 두지 않는다.
 */
export function SceneCollisionMenu({
  onViewCollision,
  runner,
}: SceneCollisionMenuProps) {
  const { t } = useTranslation();
  const enabled = useSceneCollisionStore((s) => s.enabled);
  const activeMode = useSceneCollisionStore((s) => s.activeMode);
  const collided = activeMode === 'pinned';
  const label = t('common:viewer3d.collisionMenu', {
    defaultValue: '충돌 감지',
  });

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={label}
                  aria-pressed={enabled}
                  className={cn(
                    SCENE_TOOLBAR_BUTTON_CLASS,
                    enabled &&
                      !collided &&
                      'border-amber-500/60 bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400',
                    collided &&
                      'border-red-500/60 bg-red-500/15 text-red-600 hover:bg-red-500/25 dark:text-red-400',
                  )}
                />
              }
            />
          }
        >
          <AlertTriangle />
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
      <PopoverPopup side="left" align="start" className="w-72 p-3">
        <SceneCollisionPanel
          runner={runner}
          onViewCollision={onViewCollision}
        />
      </PopoverPopup>
    </Popover>
  );
}
