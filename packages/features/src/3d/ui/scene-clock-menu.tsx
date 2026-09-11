import { Clock, Moon, Sun, Sunrise, Sunset } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SavedSceneInfo } from '@crane/domain/3d';
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
import type { SkyPhase } from '../lib/sky-lighting';
import type { SceneTimeSource } from '../model/scene-time-source';
import { useSceneClockStore } from '../model/use-scene-clock-store';
import { useSceneSunState } from '../model/use-scene-sun-state';
import { SceneClockPanel } from './scene-clock-panel';

interface SceneClockMenuProps {
  regionId: string;
  sceneInfo: SavedSceneInfo | null | undefined;
  source?: SceneTimeSource;
}

const PHASE_ICON: Record<SkyPhase, typeof Sun> = {
  day: Sun,
  dawn: Sunrise,
  dusk: Sunset,
  night: Moon,
};

/**
 * 현장 시각·낮/밤 팝업 — 모니터링 독 우측 레일용 아이콘 버튼(SceneCollisionMenu
 * 와 같은 형태). 아이콘이 현재 위상(해·일출·일몰·달)을 보여 주고, 사용자가
 * 시각을 고정해 둔 동안(manual)은 하늘색 테두리로 "실시간이 아님"을 알린다.
 * 씬이 수동 태양이면 시계 아이콘으로 두고 팝업에서 안내한다.
 *
 * PopoverTrigger 가 붙이는 data-popup-open 을 독 레일이 세어 팝업이 열린
 * 동안 접히지 않는다(scene-dock.tsx). TooltipProvider 는 ThreeSceneViewer 가
 * 감싸고 있어 여기서 두지 않는다.
 */
export function SceneClockMenu({
  regionId,
  sceneInfo,
  source = 'clock',
}: SceneClockMenuProps) {
  const { t } = useTranslation();
  const solarEnabled = sceneInfo?.lighting?.sunMode === 'solar';
  const state = useSceneSunState(regionId, source);
  const mode = useSceneClockStore((s) => s.mode);
  const pinned = mode === 'manual' && source !== 'replay' && solarEnabled;
  const Icon = solarEnabled && state ? PHASE_ICON[state.snapshot.phase] : Clock;
  const label = t('common:viewer3d.clockMenu', {
    defaultValue: '현장 시각 · 낮/밤',
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
                  aria-pressed={pinned}
                  className={cn(
                    SCENE_TOOLBAR_BUTTON_CLASS,
                    pinned &&
                      'border-sky-500/60 bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-400',
                  )}
                />
              }
            />
          }
        >
          <Icon />
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
      <PopoverPopup side="left" align="start" className="w-72 p-3">
        <SceneClockPanel
          regionId={regionId}
          source={source}
          solarEnabled={solarEnabled}
        />
      </PopoverPopup>
    </Popover>
  );
}
