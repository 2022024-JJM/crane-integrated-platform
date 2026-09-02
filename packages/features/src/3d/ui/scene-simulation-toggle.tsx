import { Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/organisms/three-scene-viewer';
import { useVirtualTagStore } from '../model/use-virtual-tag-store';

/**
 * 가상 태그 시뮬레이션 재생/정지 토글 — 모니터링 독 우측 레일용 아이콘 버튼.
 *
 * 값 흐름은 에디터 팔레트 "태그" 탭의 토글과 같다(useVirtualTagStore 의
 * start/pause). 실시간 모드에선 useSceneData 가 자동으로 켜지 않으므로 첫
 * 재생 전에 정의를 로드한다(load 는 한 번만 실제로 읽고 이후 no-op).
 * 화면을 떠날 때의 정지는 useSceneData cleanup 이 담당한다.
 *
 * TooltipProvider 는 ThreeSceneViewer 가 감싸고 있어 여기서 두지 않는다.
 */
export function SceneSimulationToggle() {
  const { t } = useTranslation();
  const isRunning = useVirtualTagStore((s) => s.isRunning);
  const load = useVirtualTagStore((s) => s.load);
  const start = useVirtualTagStore((s) => s.start);
  const pause = useVirtualTagStore((s) => s.pause);

  const label = isRunning
    ? t('common:viewer3d.simulationPause', { defaultValue: '시뮬레이션 정지' })
    : t('common:viewer3d.simulationPlay', { defaultValue: '시뮬레이션 실행' });

  const handleClick = () => {
    if (isRunning) {
      pause();
      return;
    }
    void load();
    start();
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={label}
            aria-pressed={isRunning}
            className={cn(
              SCENE_TOOLBAR_BUTTON_CLASS,
              isRunning &&
                'border-emerald-500/60 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400',
            )}
          />
        }
        onClick={handleClick}
      >
        {isRunning ? <Pause /> : <Play />}
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
