import { cn } from '../../lib/utils'
import { useInstantChoice } from '../../lib/useSnappyChoice'

export interface PillTab<K extends string> {
  key: K
  label: string
}

/**
 * 알약 탭 — 공정 화면 맨 위 갈래 [현황 | 실적]. 고른 탭이 강조색으로 채워진다.
 *
 * 강조는 이 부품 안에서 **즉시** 바뀌고, 화면 전환(`onChange`)은 트랜지션으로 넘긴다
 * (`useInstantChoice` — 사용자 지적: 탭 전환이 느리다).
 */
export function PillTabs<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: readonly PillTab<K>[]
  value: K
  onChange: (key: K) => void
  ariaLabel: string
}) {
  const [current, choose] = useInstantChoice(value, onChange)
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="viewport-surface flex shrink-0 items-center gap-1 rounded-inshop-lg border border-border bg-surface-secondary p-1"
    >
      {items.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={current === key}
          onClick={() => choose(key)}
          className={cn(
            'rounded-inshop-md px-4 py-1 text-inshop-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            current === key
              ? 'bg-accent text-on-accent shadow-sm'
              : 'text-foreground/60 hover:bg-surface-secondary hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
