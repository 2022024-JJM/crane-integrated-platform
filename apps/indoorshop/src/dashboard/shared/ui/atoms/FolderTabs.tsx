import { cn } from '../../lib/utils'
import { useInstantChoice } from '../../lib/useSnappyChoice'

export interface FolderTab<K extends string> {
  key: K
  label: string
}

/**
 * 폴더 탭 — 고른 탭과 그 아래 내용 칸이 **한 테두리**로 이어진다(사용자 확정: 현황 하위 탭).
 *
 * 내용 칸(`FolderPanel`)이 네 변을 다 두르고(오른쪽 위 모서리까지 둥글게), 고른 탭은 위·양옆만
 * 두른 채 1px 내려와 **같은 바탕색으로 칸의 윗변을 덮는다** — 그래서 탭과 칸이 한 장으로 열린다.
 * 탭 줄이 칸의 윗변을 따로 긋던 예전 방식은 오른쪽 위 모서리를 둥글릴 수 없었다(사용자 지적).
 *
 * 바탕은 **고른 탭과 내용 칸에만** 깐다(사용자 확정) — 둘이 같은 어두운 판(뷰포트 색)이라 한 장의
 * 폴더로 읽히고, 옆의 공장 목록은 페이지 바탕 그대로 선다.
 */
export function FolderTabs<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: readonly FolderTab<K>[]
  value: K
  onChange: (key: K) => void
  ariaLabel: string
  className?: string
}) {
  /* 강조는 이 부품 안에서 즉시, 화면 전환은 트랜지션으로(`useInstantChoice`) */
  const [current, choose] = useInstantChoice(value, onChange)
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('relative z-10 flex shrink-0 items-end gap-1 px-3', className)}>
      {items.map(({ key, label }) => {
        const on = current === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => choose(key)}
            className={cn(
              'px-4 py-2 text-inshop-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
              on
                ? '-mb-px rounded-t-inshop-lg border border-b-0 border-border bg-[var(--viewport)] pb-[calc(0.5rem+1px)] text-accent'
                : 'border border-transparent text-foreground/60 hover:text-foreground'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 폴더 탭 아래의 내용 칸 — 네 변을 두르고 네 모서리를 다 둥글린다. 탭 줄은 모서리 곡선을 비켜
 * 조금 안쪽(`px-3`)에서 시작한다(사용자 확정: 왼쪽 위도 둥글게). 3D 뷰어·현황이
 * 같은 어두운 판 위에 서도록 뷰포트 표면(바탕 + 토큰)을 여기서 깐다.
 */
export function FolderPanel({
  children,
  className,
  surface = true,
}: {
  children: React.ReactNode
  className?: string
  /**
   * 뷰포트 표면(어두운 판 + 토큰)을 깔까 — 3D·현황 판은 깔고(기본), 실적 화면처럼 페이지 바탕
   * 그대로 읽는 문서형 내용은 테두리만 두른다.
   */
  surface?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 flex-col rounded-inshop-lg border border-border p-3', surface && 'viewport-surface', className)}>
      {children}
    </div>
  )
}
