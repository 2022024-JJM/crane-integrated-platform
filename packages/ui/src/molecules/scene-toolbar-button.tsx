import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';
import { Button } from '../atoms/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

/**
 * 씬 툴바 버튼의 공통 외형(테마별 글래스 판). ThreeSceneViewer 의 카메라
 * 버튼과 독(SceneDock) 안의 버튼, toolbarExtras·toolbarTrailing 으로 주입되는
 * 외부 버튼(알람 토글·충돌 토글·북마크)이 모두 이 클래스를 써야 한 줄의
 * 툴바로 보인다.
 *
 * 동영상 플레이어 컨트롤 방식의 글래스 판을 테마에 맞는 색으로 깐다 —
 * 라이트는 반투명 흰 + 검정 아이콘, 다크는 반투명 검정 + 흰 아이콘. 테마
 * 토큰이나 배경 없는 반전 글자만으로는 3D 씬(하늘·지도·모델) 밝기에 따라
 * 묻혀서, 자체 배경판 + 판과 대비되는 아이콘색 조합으로 정착했다.
 * border-0 인 이유: 기본 클래스의 bg-clip-padding 때문에 투명 border 1px
 * 자리가 blur 만 비치는 링으로 보였다. dark: 변형은 outline variant 의
 * dark:bg-input/* 을 누르기 위해 명시한다.
 *
 * 독(SceneDock, `[data-scene-dock]` 조상) 안에서는 판 자체가 불투명한 테마
 * 배경이라 버튼마다 글래스 판을 두면 겹판이 된다 — `in-data-[scene-dock]`
 * 변형으로 배경·blur 를 걷어 평평한 아이콘 버튼이 되고, hover·열림·눌림만
 * accent 로 표시한다. 독 밖(툴바 배치)에서는 글래스 판 그대로다.
 */
export const SCENE_TOOLBAR_BUTTON_CLASS =
  'border-0 bg-white/40 text-black shadow-none backdrop-blur-sm hover:bg-white/60 hover:text-black aria-expanded:bg-white/60 aria-expanded:text-black dark:bg-black/40 dark:text-white dark:hover:bg-black/60 dark:hover:text-white dark:aria-expanded:bg-black/60 dark:aria-expanded:text-white ' +
  'in-data-[scene-dock]:bg-transparent in-data-[scene-dock]:text-foreground in-data-[scene-dock]:backdrop-blur-none in-data-[scene-dock]:hover:bg-accent in-data-[scene-dock]:hover:text-accent-foreground in-data-[scene-dock]:aria-expanded:bg-accent in-data-[scene-dock]:aria-expanded:text-accent-foreground in-data-[scene-dock]:aria-pressed:bg-accent ' +
  'dark:in-data-[scene-dock]:bg-transparent dark:in-data-[scene-dock]:text-foreground dark:in-data-[scene-dock]:hover:bg-accent dark:in-data-[scene-dock]:hover:text-accent-foreground dark:in-data-[scene-dock]:aria-expanded:bg-accent dark:in-data-[scene-dock]:aria-expanded:text-accent-foreground';

export type SceneToolbarTooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface SceneToolbarButtonProps {
  label: string;
  onClick: () => void;
  /** 툴팁이 열리는 방향. 툴바가 화면 위쪽이면 'bottom', 오른쪽 세로 레일이면 'left'. */
  side?: SceneToolbarTooltipSide;
  size?: 'icon-sm' | 'icon-xs';
  /** 토글 버튼일 때 눌림 상태 (aria-pressed). */
  pressed?: boolean;
  className?: string;
  children: ReactNode;
}

export function SceneToolbarButton({
  label,
  onClick,
  side = 'top',
  size = 'icon-sm',
  pressed,
  className,
  children,
}: SceneToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size={size}
            className={cn(SCENE_TOOLBAR_BUTTON_CLASS, className)}
            aria-label={label}
            aria-pressed={pressed}
          />
        }
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
