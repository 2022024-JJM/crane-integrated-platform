import { ChevronRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@crane/core/lib/utils';

/** 한 단계 들여쓰기 폭(px). */
const TREE_INDENT_PX = 12;

interface TreeRowProps extends Omit<ComponentProps<'div'>, 'children'> {
  depth: number;
  /** 자식이 있으면 펼침 토글을, 없으면 같은 폭의 빈칸을 둔다. */
  hasChildren?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  selected?: boolean;
  toggleLabel?: string;
  children: ReactNode;
}

/**
 * 계층 목록의 한 행 — 들여쓰기 + 펼침 토글 + 내용. 선택/키보드 처리는
 * 호출자가 rowProps 로 넘긴다(계층 목록마다 규칙이 달라서 여기 두지 않는다).
 */
function TreeRow({
  depth,
  hasChildren = false,
  expanded = false,
  onToggle,
  selected = false,
  toggleLabel,
  className,
  children,
  style,
  ...props
}: TreeRowProps) {
  return (
    <div
      data-slot="tree-row"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      className={cn(
        'flex items-center gap-1 rounded-sm border border-transparent py-1 pr-1.5 text-left transition',
        className,
      )}
      style={{ paddingLeft: 6 + depth * TREE_INDENT_PX, ...style }}
      {...props}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={toggleLabel}
          aria-expanded={expanded}
          className="text-muted-foreground hover:text-foreground flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm"
          onClick={(event) => {
            event.stopPropagation();
            onToggle?.();
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ChevronRight
            className={cn(
              'size-3 transition-transform',
              expanded ? 'rotate-90' : 'rotate-0',
            )}
          />
        </button>
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}
      {children}
    </div>
  );
}

export { TreeRow, TREE_INDENT_PX };
