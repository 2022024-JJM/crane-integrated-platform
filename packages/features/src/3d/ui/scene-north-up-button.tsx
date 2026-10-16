import { Navigation } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import { SCENE_TOOLBAR_BUTTON_CLASS } from '@crane/ui/molecules/scene-toolbar-button';

/**
 * "북쪽 위로" — 모니터링 독 우측 레일용 아이콘 버튼. 누르면 호출자가 카메라를
 * 타깃 축으로 돌려 화면 위가 진북이 되게 한다(lib/north-up.ts). 탑뷰면
 * 평면도가 north-up 이 되고 원근이면 시선이 북을 향한다. 상태가 없어 눌림
 * 표시도 없다. TooltipProvider 는 ThreeSceneViewer 가 감싼다.
 */
export function SceneNorthUpButton({ onNorthUp }: { onNorthUp: () => void }) {
  const { t } = useTranslation();
  const label = t('monitoring:compass.northUp');
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={label}
            className={SCENE_TOOLBAR_BUTTON_CLASS}
          />
        }
        onClick={onNorthUp}
      >
        <Navigation />
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
