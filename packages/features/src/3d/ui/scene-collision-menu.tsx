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
import { formatLeadTimeSec } from '../lib/prediction-visual';
import { useSceneCollisionStore } from '../model/use-scene-collision-store';
import { SceneCollisionPanel } from './scene-collision-panel';

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
type CollisionButtonState = 'off' | 'armed' | 'predicting' | 'collided';

/**
 * 아이콘 색은 세 단계이고 **상호배타**여야 한다. 우선순위는
 * 충돌(red) > 예측(mint) > 감지 켜짐(amber) 이다. 조건부 클래스를 나열하면
 * 같은 요소에 border/bg/text 가 두 벌 붙어 Tailwind 순서에 따라 임의로
 * 결정되므로, variant 를 하나 고른 뒤 한 번만 적용한다.
 */
function buttonState(
  enabled: boolean,
  collided: boolean,
  predicting: boolean,
): CollisionButtonState {
  if (collided) return 'collided';
  if (predicting) return 'predicting';
  return enabled ? 'armed' : 'off';
}

const STATE_CLASS: Record<CollisionButtonState, string> = {
  off: '',
  armed:
    'border-amber-500/60 bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400',
  predicting:
    'border-teal-500/60 bg-teal-500/15 text-teal-600 hover:bg-teal-500/25 dark:text-teal-300',
  collided:
    'border-red-500/60 bg-red-500/15 text-red-600 hover:bg-red-500/25 dark:text-red-400',
};

export function SceneCollisionMenu({
  onViewCollision,
  runner,
}: SceneCollisionMenuProps) {
  const { t } = useTranslation();
  const enabled = useSceneCollisionStore((s) => s.enabled);
  const activeMode = useSceneCollisionStore((s) => s.activeMode);
  const historyCount = useSceneCollisionStore((s) => s.history.length);
  const predicted = useSceneCollisionStore((s) => s.predicted);
  const collided = activeMode === 'pinned';
  const predicting = !collided && predicted !== null;
  const label = t('common:viewer3d.collisionMenu', {
    defaultValue: '충돌 감지',
  });
  // 색 단독 인코딩을 피한다 — 툴팁 문구도 상태를 말한다.
  const tooltip = collided
    ? `${label} — ${t('monitoring:sceneCollision.alertTitle')}`
    : predicting
      ? `${label} — ${t('monitoring:sceneCollision.predictTitle')} ${t(
          'monitoring:sceneCollision.predictLead',
          { seconds: formatLeadTimeSec(predicted.leadTimeSec) },
        )}`
      : label;

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
                    STATE_CLASS[buttonState(enabled, collided, predicting)],
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
        <TooltipContent side="left">{tooltip}</TooltipContent>
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
