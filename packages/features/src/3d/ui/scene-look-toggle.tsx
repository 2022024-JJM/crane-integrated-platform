import { Contrast } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/molecules/scene-toolbar-button';
import { useSceneLookStore } from '../model/use-scene-look-store';

/**
 * 관제 모드 토글 — 모니터링 독 우측 레일. 켜면 환경이 무채색으로 가라앉고
 * 색은 근접 거리 선·상태 외곽선에만 남는다(use-scene-look-store). 전역 영속.
 */
export function SceneLookToggle() {
  const { t } = useTranslation();
  const on = useSceneLookStore((s) => s.controlRoom);
  const toggle = useSceneLookStore((s) => s.toggleControlRoom);
  const label = on
    ? t('common:viewer3d.controlRoomOff', { defaultValue: '실사 모드로' })
    : t('common:viewer3d.controlRoomOn', { defaultValue: '관제 모드' });
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={label}
            aria-pressed={on}
            className={cn(
              SCENE_TOOLBAR_BUTTON_CLASS,
              on && 'bg-amber-400/90 text-black hover:bg-amber-300',
            )}
          />
        }
        onClick={toggle}
      >
        <Contrast />
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
