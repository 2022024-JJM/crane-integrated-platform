import { Binoculars, Grid2x2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';
import {
  SCENE_TOOLBAR_BUTTON_CLASS,
  SCENE_TOOLBAR_DISABLED_CLASS,
} from '@crane/ui/molecules/scene-toolbar-button';
import type { TopViewButtonsContext } from '@crane/ui/organisms/three-scene-viewer';
import { usePlanLookStore } from '../model/use-plan-look-store';

/**
 * 탑뷰 버튼 둘 — 2D 탑뷰(직교 + 평면도 룩)와 3D 탑뷰(직교만, 예전 탑뷰).
 * 뷰어의 `TopViewButtons` 슬롯에 들어간다. 둘 다 같은 직교 카메라
 * 토글이고 차이는 평면도 룩 스위치(use-plan-look-store)뿐이라, 누르면
 * 스위치를 맞춘 뒤 탑뷰에 들어가고 이미 그 모드로 탑뷰 중이면 해제한다.
 * 탑뷰 중에 다른 쪽을 누르면 카메라는 그대로 두고 룩만 바뀐다.
 */
export function SceneTopViewButtons({
  active,
  enter,
  exit,
  side,
  disabled,
  disabledLabel,
}: TopViewButtonsContext) {
  const { t } = useTranslation();
  const planLook = usePlanLookStore((s) => s.enabled);
  const setPlanLook = usePlanLookStore((s) => s.setEnabled);

  const button = (
    variant: '2d' | '3d',
    icon: React.ReactNode,
    label: string,
  ) => {
    const wantPlanLook = variant === '2d';
    const pressed = active && planLook === wantPlanLook;
    const text = disabled
      ? (disabledLabel ?? label)
      : pressed
        ? t('common:viewer3d.topViewExit')
        : label;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={text}
              aria-pressed={pressed}
              aria-disabled={disabled || undefined}
              className={cn(
                SCENE_TOOLBAR_BUTTON_CLASS,
                disabled && SCENE_TOOLBAR_DISABLED_CLASS,
              )}
            />
          }
          onClick={() => {
            if (disabled) return;
            if (pressed) {
              exit();
              return;
            }
            setPlanLook(wantPlanLook);
            if (!active) enter();
          }}
        >
          {icon}
        </TooltipTrigger>
        <TooltipContent side={side}>{text}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <>
      {button('2d', <Grid2x2 />, t('common:viewer3d.topView2d'))}
      {button('3d', <Binoculars />, t('common:viewer3d.topView3d'))}
    </>
  );
}
