import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { DraggableCard } from '../../../shared/ui/atoms/DraggableCard'
import { cn } from '../../../shared/lib/utils'
import { CloseIcon } from '../../../shared/ui/icons'
import { findLot } from '../api/yardRepository'
import type { YardMove } from '../model/types'
import { formatYardTime } from '../model/types'
import { moveColor } from '../lib/yardColors'
import type { MapTheme } from '../lib/basemapStyle'

interface YardMoveOverlayProps {
  move: YardMove
  /** 색은 순서에서 나온다 — 맵에 그려진 선과 같은 색이어야 둘이 한 짝임이 보인다 */
  index: number
  mapTheme: MapTheme
  onClose: () => void
  className?: string
}

/**
 * 고른 이동 한 건의 상세.
 *
 * 블록 상세와 같은 자리·같은 유리를 쓴다 — 둘 중 하나만 떠 있으므로 자리를 다투지
 * 않고, 야드에서 무엇을 골랐든 답은 늘 같은 모서리에서 나온다.
 */
export function YardMoveOverlay({ move, index, mapTheme, onClose, className }: YardMoveOverlayProps) {
  const { t } = useTranslation()
  const from = findLot(move.from)
  const to = findLot(move.to)

  const rows: [string, string][] = [
    [t('yard.move.from'), from ? `${move.from} · ${from.useType ?? '-'}` : move.from || '-'],
    [t('yard.move.to'), to ? `${move.to} · ${to.useType ?? '-'}` : move.to || '-'],
    [
      t('yard.move.distance'),
      move.length >= 1000 ? `${(move.length / 1000).toFixed(2)} km` : `${move.length} m`,
    ],
    [t('yard.move.mode'), move.onRoad ? t('yard.move.onRoad') : t('yard.move.direct')],
    [t('yard.move.time'), formatYardTime(move.time) ?? '-'],
    [t('yard.move.crew'), move.crew ?? '-'],
    [t('yard.move.transporter'), move.transporter ?? '-'],
  ]

  return (
    <DraggableCard
      cardKey="move"
      className={cn(
        'absolute left-3 top-3 w-64 animate-fade-in overflow-hidden rounded-inshop-lg glass-panel',
        className,
      )}
    >
      <div data-drag-handle className="flex items-center gap-1.5 border-b border-glass-border/70 px-2.5 py-2">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ background: moveColor(index, mapTheme) }}
        />
        <span className="font-mono text-inshop-xs font-semibold text-glass-foreground">
          {move.from} → {move.to}
        </span>
        <span className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('yard.detail.close')}
          className={cn(
            'shrink-0 rounded-inshop-xs p-0.5 text-glass-foreground/54 transition-colors',
            'hover:bg-glass-hover hover:text-glass-foreground',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-glass-accent',
          )}
        >
          <CloseIcon size={12} />
        </button>
      </div>

      {!move.onRoad && (
        <p className="border-b border-glass-border/70 px-2.5 py-1.5 text-2xs text-glass-degraded">
          {t('yard.move.directNote')}
        </p>
      )}

      <table className="w-full table-fixed">
        <tbody>
          {rows.map(([term, value]) => (
            <tr key={term} className="border-b border-glass-border/40 last:border-b-0">
              <th
                scope="row"
                className="w-[4.5rem] px-2.5 py-1 text-left align-top text-2xs font-normal text-glass-foreground/54"
              >
                {term}
              </th>
              <td className="px-2.5 py-1 text-right align-top text-2xs text-glass-foreground/85">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DraggableCard>
  )
}
