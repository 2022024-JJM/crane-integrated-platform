import { Shield, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/molecules/scene-toolbar-button';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';

/**
 * 충돌 감지 on/off — 모니터링 독 우측 레일용 아이콘 버튼(SceneSimulationToggle
 * 과 같은 형태). 레일에선 색이 눌리므로 on/off 를 아이콘으로 구분하고,
 * 충돌 상태만 빨강으로 강조한다.
 *
 * TooltipProvider 는 ThreeSceneViewer 가 감싸고 있어 여기서 두지 않는다.
 */
export function SceneCollisionToggle() {
  const { t } = useTranslation();
  const enabled = useSceneCollisionStore((s) => s.enabled);
  const activeMode = useSceneCollisionStore((s) => s.activeMode);
  const toggle = useSceneCollisionStore((s) => s.toggle);
  const collided = activeMode === 'pinned';

  const label = enabled
    ? t('common:viewer3d.collisionOff', { defaultValue: '충돌 감지 끄기' })
    : t('common:viewer3d.collisionOn', { defaultValue: '충돌 감지 켜기' });

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
                !collided &&
                'border-sky-500/60 bg-sky-500/15 text-sky-600 hover:bg-sky-500/25 dark:text-sky-400',
              collided &&
                'border-red-500/60 bg-red-500/15 text-red-600 hover:bg-red-500/25 dark:text-red-400',
            )}
          />
        }
        onClick={toggle}
      >
        {enabled ? <ShieldAlert /> : <Shield />}
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>{label}</p>
        <p className="text-muted-foreground text-[10px]">
          {t('common:viewer3d.collisionBvhHint', {
            defaultValue: '정밀 검사는 모델 로드 직후 몇 초간 준비됩니다.',
          })}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
