import { BookmarkPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SavedCameraInfo } from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Input } from '@crane/ui/atoms/input';
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuTrigger,
} from '@crane/ui/molecules/context-menu';
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
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/organisms/three-scene-viewer';
import {
  SCENE_VIEW_NAME_MAX,
  SCENE_VIEWS_MAX,
  useSceneViewsStore,
} from '../model/use-scene-views-store';

interface SceneViewBookmarksProps {
  regionId: string;
  /** 현재 카메라 포즈. 컨트롤러 준비 전이면 null. */
  getPose: () => SavedCameraInfo | null;
  /** 저장된 포즈로 카메라를 즉시 옮긴다 — 리셋(원래 위치) 버튼과 같은 경로. */
  onMoveTo: (position: Vector3Tuple, target: Vector3Tuple) => void;
}

/**
 * 씬 뷰 북마크 — ThreeSceneViewer 좌측 하단 툴바의 toolbarTrailing 슬롯에
 * 붙어 줌/리셋 버튼과 한 줄로 이어진다(같은 글래스 outline 스타일).
 *
 * `+` 버튼 하나만 두고, 누르면 위쪽으로 이름 입력 팝오버가 뜬다(툴바 폭이
 * 변하지 않아 옆 버튼들이 밀리지 않는다). 저장된 뷰는 `+` 오른쪽에 이름 칩으로
 * 나열되며 클릭하면 리셋 버튼처럼 한 번에 그 포즈로 이동한다(플라이트 애니메이션
 * 없음). 삭제는 칩 우클릭 컨텍스트 메뉴로만 —
 * 칩마다 X 버튼을 두면 툴바가 어수선해지고 오클릭으로 지우기 쉽다.
 *
 * TooltipProvider는 ThreeSceneViewer 툴바가 감싸고 있어 여기서 두지 않는다.
 */
export function SceneViewBookmarks({
  regionId,
  getPose,
  onMoveTo,
}: SceneViewBookmarksProps) {
  const { t } = useTranslation();
  const views = useSceneViewsStore((s) => s.viewsByRegion[regionId]);
  const hydrate = useSceneViewsStore((s) => s.hydrate);
  const addView = useSceneViewsStore((s) => s.addView);
  const removeView = useSceneViewsStore((s) => s.removeView);

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveCurrentView();
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Popover
        open={isAdding}
        onOpenChange={(open) => {
          if (open) {
            setIsAdding(true);
          } else {
            closeForm();
          }
        }}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t('monitoring:sceneViews.saveCurrent')}
                    disabled={isAtLimit}
                    className={SCENE_TOOLBAR_BUTTON_CLASS}
                  />
                }
              />
            }
          >
            <BookmarkPlus />
          </TooltipTrigger>
          <TooltipContent>
            {isAtLimit
              ? t('monitoring:sceneViews.limitReached', {
                  max: SCENE_VIEWS_MAX,
                })
              : t('monitoring:sceneViews.saveCurrent')}
          </TooltipContent>
        </Tooltip>
        <PopoverPopup
          side="top"
          align="start"
          initialFocus={inputRef}
          className="w-64 p-3"
        >
          <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
            <p className="text-xs font-semibold">
              {t('monitoring:sceneViews.saveCurrent')}
            </p>
            <Input
              ref={inputRef}
              value={name}
              maxLength={SCENE_VIEW_NAME_MAX}
              placeholder={t('monitoring:sceneViews.namePlaceholder')}
              aria-invalid={isDuplicate || undefined}
              onChange={(event) => setName(event.target.value)}
              className={cn('h-8 text-xs', isDuplicate && 'text-destructive')}
            />
            {isDuplicate ? (
              <p className="text-destructive text-[11px] leading-4">
                {t('monitoring:sceneViews.duplicateName')}
              </p>
            ) : null}
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeForm}
              >
                {t('monitoring:sceneViews.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={!canSave}>
                {t('monitoring:sceneViews.save')}
              </Button>
            </div>
          </form>
        </PopoverPopup>
      </Popover>

      {viewList.length > 0 ? (
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto py-px">
          {viewList.map((view) => (
            <ContextMenu key={view.id}>
              <ContextMenuTrigger render={<div className="flex shrink-0" />}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          SCENE_TOOLBAR_BUTTON_CLASS,
                          'max-w-40 text-xs',
                        )}
                      />
                    }
                    onClick={() => onMoveTo(view.position, view.target)}
                  >
                    <span className="truncate">{view.name}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="flex flex-col">
                      <span>
                        {t('monitoring:sceneViews.flyTo', { name: view.name })}
                      </span>
                      <span className="text-background/70">
                        {t('monitoring:sceneViews.deleteHint')}
                      </span>
                    </span>
                  </TooltipContent>
                </Tooltip>
              </ContextMenuTrigger>
              <ContextMenuPopup>
                <ContextMenuItem
                  className="text-destructive data-[highlighted]:text-destructive"
                  onClick={() => removeView(regionId, view.id)}
                >
                  {t('monitoring:sceneViews.delete')}
                </ContextMenuItem>
              </ContextMenuPopup>
            </ContextMenu>
          ))}
        </div>
      ) : null}
    </div>
  );
}
