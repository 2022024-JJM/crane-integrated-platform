import { useTranslation } from '../../lib/i18n/useTranslation'
import { cn } from '../../lib/utils'
import type { SeparatorProps } from '../../lib/useResizablePanel'

interface ResizeHandleProps extends SeparatorProps {
  dragging: boolean
  className?: string
}

/**
 * 두 칸 사이의 세로 경계 — 잡아 끌면 폭이 바뀌고, 더블클릭하면 기본 폭으로 돌아온다.
 *
 * 손잡이는 **항상 보인다**. 얹었을 때만 나타나게 하면 끌 수 있다는 걸 알 방법이
 * 없어서, 사용자는 폭이 고정된 화면으로 읽는다. 대신 평소에는 경계선과 같은
 * 중립색으로 가늘게 두고, 손을 얹거나 끌 때만 강조색으로 살린다.
 *
 * 잡는 영역(12px)과 보이는 선(1px)은 따로 둔다 — 집기 쉬우면서 화면은 안 먹는다.
 */
export function ResizeHandle({ dragging, className, ...separatorProps }: ResizeHandleProps) {
  const { t } = useTranslation()

  return (
    <div
      {...separatorProps}
      title={t('viewer.resizeHandle')}
      className={cn(
        'group relative w-3 shrink-0 cursor-col-resize touch-none select-none',
        'focus:outline-none',
        className,
      )}
    >
      {/* 경계선 — 두 칸을 가르는 실선 */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors',
          dragging ? 'bg-accent' : 'bg-border group-hover:bg-accent/50',
        )}
      />
      {/* 손잡이 — 가운데에만 짧게. 선보다 조금 굵어야 "집는 곳"으로 읽힌다 */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-1/2 top-1/2 h-9 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors',
          dragging
            ? 'bg-accent'
            : 'bg-border group-hover:bg-accent group-focus-visible:bg-accent',
        )}
      />
    </div>
  )
}
