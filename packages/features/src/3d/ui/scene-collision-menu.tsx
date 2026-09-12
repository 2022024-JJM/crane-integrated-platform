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
import type { SceneCollisionRunner } from '../model/scene-collision-hold';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import { SceneCollisionPanel } from './scene-collision-panel';

interface SceneCollisionMenuProps {
  onViewCollision: () => void;
  runner: SceneCollisionRunner;
}

/**
 * 충돌 감지 팝업 — 모니터링 독 우측 레일용 아이콘 버튼(SceneSimulationToggle
 * 과 같은 형태). 누르면 에디터 시뮬레이션 탭 충돌 하위 탭과 같은
 * 패널(SceneCollisionPanel)이 왼쪽으로 열린다. 영역 침범은 2026-09-12 에
 * 별도 레일 아이콘(SceneZoneMenu)으로 분리됐다 — 여기 아래에 이어 붙어
 * 있었다. 레일에선 버튼 배경이 평면화되므로 감지 켜짐(amber)·충돌
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
  const historyCount = useSceneCollisionStore((s) => s.history.length);
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
                    'relative',
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
          {/* 충돌 기록 수 배지 — 독이 접혀 있다 펼쳐졌을 때 "몇 건 쌓였는지"가
              hover·클릭 없이 보이게 한다. */}
          {historyCount > 0 ? (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] leading-none font-bold text-white"
            >
              {historyCount}
            </span>
          ) : null}
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
