import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../lib/i18n/useTranslation'
import { FavoriteToggle, clearFavorites, useFavorites } from '../../features/favorites'
import { ZoneBadge, hrefOfEntry } from '../../features/view-history'
import { useDismissable } from '../../lib/useDismissable'
import { cn } from '../../lib/utils'
import { AnchoredMenuPanel } from '../../ui/atoms/AnchoredMenuPanel'
import { IconButton } from '../../ui/atoms/IconButton'
import { StarIcon } from '../../ui/icons'

/**
 * 헤더의 즐겨찾기 버튼 — 고정해 둔 **호선-블록 × 화면** 목록을 편다(히스토리와 같은 틀, 사용자 확정).
 * 줄을 누르면 그 화면의 그 블록으로 가고, 줄의 ★ 로 뺀다. 넣는 곳은 블록 탭 · 히스토리 줄의 ☆ 다.
 */
export function FavoritesMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const entries = useFavorites()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useDismissable(open, containerRef, close, buttonRef, panelRef)


  return (
    <div ref={containerRef} className="relative">
      <IconButton
        ref={buttonRef}
        aria-label={t('favorites.open')}
        title={t('favorites.open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        active={open}
        onClick={() => setOpen((v) => !v)}
      >
        <StarIcon size={17} />
      </IconButton>

      {open && (
        <AnchoredMenuPanel
          anchorRef={buttonRef}
          panelRef={panelRef}
          role="dialog"
          aria-label={t('favorites.title')}
          className="w-[min(20rem,calc(100vw-1.5rem))]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-material-border px-3.5 py-3">
            <p className="truncate text-inshop-sm font-semibold text-foreground">{t('favorites.title')}</p>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={clearFavorites}
                className="rounded-inshop-sm px-1.5 py-0.5 text-2xs text-foreground/55 transition-colors hover:bg-foreground/8 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('favorites.clear')}
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-inshop-xs leading-5 text-foreground/50">{t('favorites.empty')}</p>
          ) : (
            <ul aria-label={t('favorites.title')} className="max-h-[min(26rem,60vh)] overflow-y-auto py-1">
              {entries.map((entry) => (
                <li
                  key={`${entry.zone}:${entry.projNo}-${entry.blockNo}`}
                  className="flex items-center pr-2.5 transition-colors hover:bg-foreground/6"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      navigate(hrefOfEntry(entry))
                    }}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-3 py-2 pl-3.5 text-left',
                      'focus:outline-none focus-visible:bg-foreground/6'
                    )}
                  >
                    <ZoneBadge zone={entry.zone} />
                    <span className="min-w-0 flex-1 truncate text-inshop-sm font-semibold tabular-nums text-foreground">
                      {entry.projNo}-{entry.blockNo}
                    </span>
                  </button>
                  <FavoriteToggle zone={entry.zone} projNo={entry.projNo} blockNo={entry.blockNo} />
                </li>
              ))}
            </ul>
          )}
        </AnchoredMenuPanel>
      )}
    </div>
  )
}
