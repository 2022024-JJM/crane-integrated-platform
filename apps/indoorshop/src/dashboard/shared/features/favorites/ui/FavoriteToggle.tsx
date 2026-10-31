import { useTranslation } from '../../../lib/i18n/useTranslation'
import type { HistoryZone } from '../../view-history'
import { cn } from '../../../lib/utils'
import { StarIcon } from '../../../ui/icons'
import { toggleFavorite, useFavorites } from '../model/favorites'

/**
 * ☆ / ★ — 이 화면의 이 블록을 즐겨찾기에 넣고 뺀다. 블록 탭 · 히스토리 · 즐겨찾기 목록이 같은 버튼을 쓴다.
 * 안에서 눌러도 바깥(탭 · 줄)의 클릭으로 번지지 않는다.
 */
export function FavoriteToggle({
  zone,
  projNo,
  blockNo,
  className,
  size = 14,
}: {
  zone: HistoryZone
  projNo: string
  blockNo: string
  className?: string
  size?: number
}) {
  const { t } = useTranslation()
  const on = useFavorites().some((e) => e.zone === zone && e.projNo === projNo && e.blockNo === blockNo)
  const label = on
    ? t('favorites.remove', { target: `${projNo}-${blockNo}` })
    : t('favorites.add', { target: `${projNo}-${blockNo}` })
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        toggleFavorite(zone, projNo, blockNo)
      }}
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        on ? 'text-status-degraded hover:bg-surface-secondary' : 'text-foreground/35 hover:bg-surface-secondary hover:text-foreground/70',
        className
      )}
    >
      <StarIcon size={size} filled={on} />
    </button>
  )
}
