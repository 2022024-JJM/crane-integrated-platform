import { Gauge } from 'lucide-react';
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
import { useVirtualTagStore } from '../model/use-virtual-tag-store';
import { SceneSimulationPanel } from './scene-simulation-panel';

/**
 * 시뮬레이션 시계 팝업 — 모니터링 독 우측 레일(▶ 토글 옆). 배속이 1 이 아니거나
 * 시나리오가 활성이면 아이콘을 sky 로 물들이고 배속 배지를 붙인다.
 * TooltipProvider 는 ThreeSceneViewer 가 감싸고 있어 여기서 두지 않는다.
 */
export function SceneSimulationMenu({ onStop }: { onStop?: () => void } = {}) {
  const { t } = useTranslation();
  const speed = useVirtualTagStore((s) => s.speed);
  const activeScenarioId = useVirtualTagStore((s) => s.activeScenarioId);
  const label = t('common:viewer3d.simulationMenu', {
    defaultValue: '시뮬레이션 시계',
  });
  const highlighted = speed !== 1 || activeScenarioId !== null;

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
                  className={cn(
                    SCENE_TOOLBAR_BUTTON_CLASS,
                    'relative',
                    highlighted &&
                      'border-sky-500/60 bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-400',
                  )}
                />
              }
            />
          }
        >
          <Gauge />
          {speed !== 1 ? (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-0.5 font-mono text-[9px] leading-none font-bold text-white"
            >
              ×{speed}
            </span>
          ) : null}
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
      <PopoverPopup side="left" align="start" className="w-72 p-3">
        <SceneSimulationPanel onStop={onStop} />
      </PopoverPopup>
    </Popover>
  );
}
