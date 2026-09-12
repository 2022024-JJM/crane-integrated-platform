import { Map as MapIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/molecules/scene-toolbar-button';
import { useSceneMinimapStore } from '../model/use-scene-minimap-store';

/**
 * 2D 미니맵 표시/숨김 토글 — 모니터링 독 우측 레일용 아이콘 버튼.
 * 미니맵 자체의 X 버튼과 같은 상태(useSceneMinimapStore.visible, 영속)를
 * 바꾼다. TooltipProvider 는 ThreeSceneViewer 가 감싸고 있어 여기서 두지 않는다.
 */
export function SceneMinimapToggle() {
  const { t } = useTranslation();
  const visible = useSceneMinimapStore((s) => s.visible);
  const toggleVisible = useSceneMinimapStore((s) => s.toggleVisible);

  const label = visible
    ? t('common:viewer3d.minimapHide', { defaultValue: '미니맵 숨기기' })
    : t('common:viewer3d.minimapShow', { defaultValue: '미니맵 표시' });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={label}
            aria-pressed={visible}
            className={cn(SCENE_TOOLBAR_BUTTON_CLASS)}
          />
        }
        onClick={toggleVisible}
      >
        <MapIcon />
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
