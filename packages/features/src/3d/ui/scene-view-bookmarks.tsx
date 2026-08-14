import { Check, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SavedCameraInfo } from '@crane/domain/3d';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import {
  SCENE_VIEW_NAME_MAX,
  SCENE_VIEWS_MAX,
  useSceneViewsStore,
} from '../model/use-scene-views-store';

interface SceneViewBookmarksProps {
  regionId: string;
  /** 현재 카메라 포즈. 컨트롤러 준비 전이면 null. */
  getPose: () => SavedCameraInfo | null;
}

/**
 * 전체화면 하단의 씬 뷰 북마크 바.
 *
 * 평소에는 저장된 뷰 라벨들과 `+` 버튼만 있는 조용한 글래스 칩이고,
 * `+`를 누르면 이름 입력이 인라인으로 펼쳐진다(씬 오버레이 절제 원칙).
 * 라벨 클릭 → 스토어에 비행 요청 → SceneViewFlightRig가 카메라를 옮긴다.
 */
export function SceneViewBookmarks({
  regionId,
  getPose,
}: SceneViewBookmarksProps) {
  const { t } = useTranslation();
  const views = useSceneViewsStore((s) => s.viewsByRegion[regionId]);
  const hydrate = useSceneViewsStore((s) => s.hydrate);
  const addView = useSceneViewsStore((s) => s.addView);
  const removeView = useSceneViewsStore((s) => s.removeView);
  const requestFlight = useSceneViewsStore((s) => s.requestFlight);

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    hydrate(regionId);
  }, [hydrate, regionId]);

  const viewList = views ?? [];
  const trimmedName = name.trim();
  const isDuplicate = viewList.some(
    (view) => view.name.toLowerCase() === trimmedName.toLowerCase(),
  );
  const isAtLimit = viewList.length >= SCENE_VIEWS_MAX;
  const canSave = trimmedName.length > 0 && !isDuplicate;

  const closeForm = () => {
    setIsAdding(false);
    setName('');
  };

  const saveCurrentView = () => {
    const pose = getPose();
    if (!pose || !canSave) {
      return;
    }
    if (addView(regionId, trimmedName, pose)) {
      closeForm();
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.stopPropagation();
      saveCurrentView();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      closeForm();
    }
  };

  return (
    <TooltipProvider delay={150}>
      <div className="bg-background/95 border-border/80 flex h-[34px] items-center gap-1 rounded-lg border p-px shadow-sm backdrop-blur-sm">
        {viewList.length > 0 ? (
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {viewList.map((view) => (
              <div key={view.id} className="flex shrink-0 items-center">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground h-8 max-w-40 rounded-md px-2 text-xs"
                      />
                    }
                    onClick={() =>
                      requestFlight({
                        position: view.position,
                        target: view.target,
                      })
                    }
                  >
                    <span className="truncate">{view.name}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('monitoring:sceneViews.flyTo', { name: view.name })}
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('monitoring:sceneViews.deleteView', {
                    name: view.name,
                  })}
                  className="text-muted-foreground -ml-1 size-5 rounded-md opacity-60 hover:opacity-100"
                  onClick={() => removeView(regionId, view.id)}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {isAdding ? (
          <div className="flex shrink-0 items-center gap-1">
            <div className="border-border bg-muted focus-within:border-ring focus-within:ring-ring/50 flex h-8 items-center rounded-md border px-2 transition-colors focus-within:ring-3">
              <Input
                autoFocus
                value={name}
                maxLength={SCENE_VIEW_NAME_MAX}
                placeholder={t('monitoring:sceneViews.namePlaceholder')}
                aria-invalid={isDuplicate || undefined}
                title={
                  isDuplicate
                    ? t('monitoring:sceneViews.duplicateName')
                    : undefined
                }
                onChange={(event) => setName(event.target.value)}
                onKeyDown={handleInputKeyDown}
                className={`h-full w-32 border-0 bg-transparent px-0 text-xs shadow-none focus:border-0 focus:ring-0 ${
                  isDuplicate ? 'text-destructive' : ''
                }`}
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('monitoring:sceneViews.save')}
              disabled={!canSave}
              className="size-8 rounded-md"
              onClick={saveCurrentView}
            >
              <Check className="size-4" />
            </Button>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('monitoring:sceneViews.saveCurrent')}
                  disabled={isAtLimit}
                  className="size-8 rounded-md"
                />
              }
              onClick={() => setIsAdding(true)}
            >
              <Plus className="size-4" />
            </TooltipTrigger>
            <TooltipContent>
              {isAtLimit
                ? t('monitoring:sceneViews.limitReached', {
                    max: SCENE_VIEWS_MAX,
                  })
                : t('monitoring:sceneViews.saveCurrent')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
