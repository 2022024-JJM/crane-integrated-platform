import { Radar } from 'lucide-react';
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
import { useSceneZoneStore } from '../model/use-scene-zone-store';
import { SceneZonePanel } from './scene-zone-panel';

/**
 * 영역 침범 팝업 — 모니터링 독 우측 레일용 아이콘 버튼(SceneCollisionMenu 와
 * 같은 형태). 에디터 팔레트 "영역" 탭과 같은 패널(SceneZonePanel)이 왼쪽으로
 * 열린다. 2026-09-12 까지는 충돌 팝업 아래에 이어 붙어 있었지만, 충돌(정지·
 * 기록)과 영역(현재 상태)은 의미가 달라 레일 아이콘을 따로 둔다.
 *
 * 색은 충돌 아이콘과 같은 규칙 — 감지 켜짐 amber, 침범 중 red + 침범 영역 수
 * 배지(충돌의 기록 수 배지 자리와 같다). 영역 자체의 색은 식별자일 뿐이라
 * 여기로 끌어오지 않는다(scene-zone-rings 주석).
 *
 * PopoverTrigger 가 붙이는 data-popup-open 을 독 레일이 세어 팝업이 열린
 * 동안 접히지 않는다(scene-dock.tsx). TooltipProvider 는 ThreeSceneViewer 가
 * 감싸고 있어 여기서 두지 않는다.
 */
export function SceneZoneMenu({
  onViewZone,
}: {
  /** 침범 행의 [영역 보기](SceneZonePanel 로 전달). */
  onViewZone?: (zoneKey: string) => void;
} = {}) {
  const { t } = useTranslation();
  const enabled = useSceneZoneStore((s) => s.enabled);
  const intrusionCount = useSceneZoneStore((s) => s.intrusions.length);
  const intruded = enabled && intrusionCount > 0;
  const label = t('common:viewer3d.zoneMenu', { defaultValue: '영역 감지' });

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
                      !intruded &&
                      'border-amber-500/60 bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400',
                    intruded &&
                      'border-red-500/60 bg-red-500/15 text-red-600 hover:bg-red-500/25 dark:text-red-400',
                  )}
                />
              }
            />
          }
        >
          <Radar />
          {intruded ? (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] leading-none font-bold text-white"
            >
              {intrusionCount}
            </span>
          ) : null}
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
      <PopoverPopup side="left" align="start" className="w-72 p-3">
        <SceneZonePanel onViewZone={onViewZone} />
      </PopoverPopup>
    </Popover>
  );
}
