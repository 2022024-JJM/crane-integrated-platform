import type { ComponentProps } from 'react';

import { cn } from '@crane/core/lib/utils';

/**
 * 키 표기 아톰. `data-slot="kbd"` 는 TooltipContent 가 인식하는 훅이라
 * (tooltip.tsx: 우측 여백 축소·z-index) 툴팁 안에 그대로 넣으면 된다.
 * 툴팁은 전경색 배경(`bg-foreground text-background`)이라 그 안에서는
 * 배경·테두리·글자색을 반전한다.
 */
function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'bg-muted border-border text-foreground pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded border px-1.5 font-mono text-[11px] leading-none select-none',
        'in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:border-background/30 in-data-[slot=tooltip-content]:text-background',
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
