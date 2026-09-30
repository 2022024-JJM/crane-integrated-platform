import { LayoutGrid } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SavedSceneView } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/molecules/scene-toolbar-button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';

/**
 * 분할 버튼의 상태. 'disabled' 는 버튼을 회색으로 두고 `disabledLabel` 을
 * 툴팁으로 보인다(에디터 — 분할은 모니터링 화면에서만 확인할 수 있다).
 */
export interface SceneViewBarSplit {
  state: 'enabled' | 'disabled';
  /** 지금 분할 화면인지 — 버튼 눌림 표시와 툴팁 문구가 바뀐다. */
  active: boolean;
  onToggle: () => void;
  disabledLabel?: string;
}

interface SceneViewBarProps {
  /** 표시할 뷰 — 호출자가 고정한 뷰만 걸러 넘긴다. */
  views: readonly SavedSceneView[];
  onSelectView: (view: SavedSceneView) => void;
  /** 분할 버튼. 없으면 그리지 않는다(분할이 고정되지 않은 씬). */
  split?: SceneViewBarSplit | null;
  className?: string;
}

/**
 * 우상단 고정 줄 — 에디터에서 고정한 뷰 버튼들과 분할 버튼이 한 줄로 온다.
 * 모니터링·3D 플레이·에디터가 같은 컴포넌트를 쓴다. 뷰 버튼은 누르면 그
 * 구도로 옮기는 버튼일 뿐 선택 상태를 두지 않는다. 이름이 길거나 많으면
 * 버튼이 말줄임되고 줄이 가로 스크롤로 흡수한다 — 오른쪽 위 타일의 이름을
 * 덮지 않게 최대 폭을 둔다.
 *
 * 비활성 분할 버튼은 `disabled` 속성이 아니라 `aria-disabled` 다 — `disabled`
 * 는 포인터 이벤트를 막아 툴팁이 뜨지 않는다.
 */
export function SceneViewBar({
  views,
  onSelectView,
  split,
  className,
}: SceneViewBarProps) {
  const { t } = useTranslation();
  if (views.length === 0 && !split) return null;

  const splitDisabled = split?.state === 'disabled';
  const splitLabel = splitDisabled
    ? (split?.disabledLabel ?? t('monitoring:sceneSplit.editorOnly'))
    : split?.active
      ? t('monitoring:sceneSplit.exit')
      : t('monitoring:sceneSplit.enter');

  return (
    <TooltipProvider delay={150}>
      <div
        data-slot="scene-view-bar"
        className={cn(
          'pointer-events-auto flex max-w-[40vw] items-center gap-0.75',
          className,
        )}
      >
        {views.length > 0 ? (
          <div className="flex min-w-0 items-center gap-0.75 overflow-x-auto py-px">
            {views.map((view) => (
              <Tooltip key={view.id}>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        SCENE_TOOLBAR_BUTTON_CLASS,
                        'max-w-32 shrink-0 text-xs',
                      )}
                    />
                  }
                  onClick={() => onSelectView(view)}
                >
                  <span className="truncate">{view.name}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t('monitoring:sceneViews.flyTo', { name: view.name })}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : null}
        {split ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={splitLabel}
                  aria-pressed={split.active}
                  aria-disabled={splitDisabled || undefined}
                  className={cn(
                    SCENE_TOOLBAR_BUTTON_CLASS,
                    'shrink-0',
                    splitDisabled && 'cursor-not-allowed opacity-50',
                  )}
                />
              }
              onClick={() => {
                if (splitDisabled) return;
                split.onToggle();
              }}
            >
              <LayoutGrid />
            </TooltipTrigger>
            <TooltipContent side="bottom">{splitLabel}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
