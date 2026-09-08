import { useLanguage } from '../../../shared/lib/i18n/useLanguage'
import { cn } from '../../../shared/lib/utils'

export interface CountBarItem {
  key: string
  label: string
  /** 라벨 옆에 옅게 붙는 코드값 */
  code?: string
  count: number
  /** 라벨 뒤에 붙는 작은 표식 (예: 종단) */
  badge?: string
  /** 마크 hover 툴팁 */
  title?: string
}

/**
 * 건수 막대 목록 — 단일 색조(accent), 값은 막대 끝에 직접 표기.
 *
 * 절점·상태는 정해진 순서가 있는 범주라 세로 막대 차트보다 이 형태가 읽기 쉽다 —
 * 라벨이 길어도 잘리지 않고, 순서가 곧 공정 흐름이다. 색은 정체성을 나르지 않으므로
 * (항목이 곧 행) 계열색을 쓰지 않고 한 색조로만 크기를 낸다. 마크는 얇게, 트랙은 바탕색.
 */
export function CountBars({ items, emptyLabel }: { items: CountBarItem[]; emptyLabel: string }) {
  const { locale } = useLanguage()
  const max = Math.max(1, ...items.map((item) => item.count))
  const total = items.reduce((sum, item) => sum + item.count, 0)

  if (items.length === 0 || total === 0) {
    return <p className="py-4 text-inshop-sm text-foreground/58">{emptyLabel}</p>
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} title={item.title} className="group grid grid-cols-[minmax(7rem,1fr)_3fr_3.5rem] items-center gap-3">
          <span className="min-w-0 truncate text-inshop-sm text-foreground">
            {item.label}
            {item.code && item.code !== item.label && (
              <span className="ml-1.5 font-mono text-2xs text-foreground/50">{item.code}</span>
            )}
            {item.badge && (
              <span className="ml-1.5 rounded-inshop-xs bg-surface-secondary px-1 py-px text-2xs text-foreground/58">
                {item.badge}
              </span>
            )}
          </span>
          <span className="h-2.5 overflow-hidden rounded-inshop-xs bg-surface-secondary">
            <span
              className={cn(
                'block h-full rounded-inshop-xs bg-accent transition-[width] duration-300 group-hover:opacity-70',
                item.count === 0 && 'w-0',
              )}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-mono text-inshop-sm font-semibold text-foreground">
            {item.count.toLocaleString(locale)}
          </span>
        </li>
      ))}
    </ul>
  )
}
