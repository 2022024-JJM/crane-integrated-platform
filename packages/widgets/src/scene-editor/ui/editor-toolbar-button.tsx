import type { ReactNode } from 'react';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { Kbd } from '@crane/ui/atoms/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@crane/ui/molecules/tooltip';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

interface EditorToolbarButtonProps {
  label: string;
  onClick: () => void;
  /**
   * 버튼 성격. `action` 은 지속 상태가 없어 눌림 피드백만 있고, `toggle` 은
   * 독립 on/off 라 하단 인디케이터 점으로 약하게 표시한다. 모달 도구(하나만
   * 활성)는 SceneTransformModeToggle 이 배경 채움으로 따로 표현한다 —
   * 토글을 모달처럼 채우면 둘이 구분되지 않는다.
   */
  kind?: 'action' | 'toggle';
  /** kind === 'toggle' 일 때의 현재 상태(aria-pressed). */
  pressed?: boolean;
  /** 툴팁에 병기할 키 조합. 각 항목이 Kbd 하나가 된다. */
  shortcut?: readonly string[];
  disabled?: boolean;
  side?: TooltipSide;
  className?: string;
  children: ReactNode;
}

// 상자 크기는 Button size="icon-sm"(size-7 = 28px) 그대로 쓴다 — 헤더 바
// (h-9) 안 이웃 컨트롤(모드 토글·좌표계·스냅)도 같은 28px 에 맞춰져 있다.
const BASE_CLASS =
  'text-muted-foreground hover:text-foreground relative rounded-md';

const TOGGLE_CLASS =
  'aria-pressed:text-foreground after:absolute after:bottom-0.5 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-transparent aria-pressed:after:bg-primary';

/** 편집기 도구 모음 공용 아이콘 버튼 — 툴팁·단축키 병기·성격별 활성 표현. */
export function EditorToolbarButton({
  label,
  onClick,
  kind = 'action',
  pressed,
  shortcut,
  disabled,
  side = 'top',
  className,
  children,
}: EditorToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={kind === 'toggle' ? Boolean(pressed) : undefined}
            disabled={disabled}
            className={cn(
              BASE_CLASS,
              kind === 'toggle' && TOGGLE_CLASS,
              className,
            )}
          />
        }
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {shortcut?.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
