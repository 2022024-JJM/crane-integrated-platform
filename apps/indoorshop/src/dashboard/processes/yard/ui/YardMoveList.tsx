import { memo } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import type { YardMove } from '../model/types'
import { formatYardTime } from '../model/types'
import { moveColor } from '../lib/yardColors'
import type { MapTheme } from '../lib/basemapStyle'

interface YardMoveListProps {
  moves: YardMove[]
  /** 줄 앞 색점을 맵의 선과 맞추기 위해서만 쓴다 */
  mapTheme: MapTheme
  selectedIndex: number | null
  onSelectMove: (index: number) => void
  onHoverLot?: (lot: string | null) => void
  className?: string
}

/**
 * 고른 날의 이동 실적 목록.
 *
 * 맵에서 경로를 누르려면 먼저 그 경로가 어디 있는지 알아야 한다 — 하루 50건이 겹쳐
 * 깔린 화면에서 그건 쉬운 일이 아니다. 목록은 그 순서를 뒤집는다: **시각 순으로
 * 훑다가 하나를 고르면 맵이 그 경로로 간다.**
 *
 * 줄 앞의 색점은 장식이 아니다 — 맵에 그려진 선과 같은 색이라, 목록과 야드를 잇는
 * 유일한 끈이다.
 */
export const YardMoveList = memo(function YardMoveList({
  moves,
  mapTheme,
  selectedIndex,
  onSelectMove,
  onHoverLot,
  className,
}: YardMoveListProps) {
  const { t } = useTranslation()

  if (moves.length === 0) {
    return (
      <p className={cn('px-1 py-8 text-center text-inshop-sm text-foreground/54', className)}>
        {t('yard.move.empty')}
      </p>
    )
  }

  return (
    <ul className={cn('space-y-1', className)}>
      {moves.map((move, index) => {
        const selected = index === selectedIndex
        return (
          <li key={`${move.from}-${move.to}-${move.time}-${index}`}>
            <button
              type="button"
              ref={selected ? (node) => node?.scrollIntoView({ block: 'nearest' }) : undefined}
              onClick={() => onSelectMove(index)}
              onMouseEnter={() => onHoverLot?.(move.to)}
              onMouseLeave={() => onHoverLot?.(null)}
              className={cn(
                'flex w-full cursor-pointer flex-col gap-0.5 rounded-inshop-md border px-2.5 py-2 text-left transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                selected
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-accent/50 hover:bg-foreground/4',
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: moveColor(index, mapTheme) }}
                />
                <span
                  className={cn(
                    'font-mono text-inshop-xs font-semibold',
                    selected ? 'text-accent' : 'text-foreground',
                  )}
                >
                  {move.from} → {move.to}
                </span>
                <span className="ml-auto shrink-0 font-mono text-2xs text-foreground/54 tabular-nums">
                  {formatYardTime(move.time) ?? '-'}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5 pl-3">
                <span className="font-mono text-2xs text-foreground/68 tabular-nums">
                  {move.length >= 1000
                    ? `${(move.length / 1000).toFixed(2)} km`
                    : `${move.length} m`}
                </span>
                <span className="min-w-0 flex-1 truncate text-2xs text-foreground/54">
                  {move.crew ?? '-'}
                  {move.transporter ? ` · TP ${move.transporter}` : ''}
                  {move.onRoad ? '' : ` · ${t('yard.move.direct')}`}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
})
