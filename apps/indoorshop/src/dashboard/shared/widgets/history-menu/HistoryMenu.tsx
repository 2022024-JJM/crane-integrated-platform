import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../../lib/i18n/useTranslation'
import { FavoriteToggle } from '../../features/favorites'
import { ZoneBadge, clearViewHistory, hrefOfEntry, useViewHistory } from '../../features/view-history'
import { useDismissable } from '../../lib/useDismissable'
import { cn } from '../../lib/utils'
import { AnchoredMenuPanel } from '../../ui/atoms/AnchoredMenuPanel'
import { IconButton } from '../../ui/atoms/IconButton'
import { HistoryIcon } from '../../ui/icons'

/**
 * 헤더의 히스토리 버튼 — 내가 열었던 **호선-블록 × 화면**(통합실적·가공·조립·의장·도장) 목록을 편다.
 * 줄을 누르면 그 화면의 그 블록으로 간다(사용자 확정). 기록은 `view-history` 가 맡는다.
 */
export function HistoryMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const entries = useViewHistory()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  /* 목록은 포털로 나가 있다 — 바깥 클릭 판정에 따로 넘긴다 */
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useDismissable(open, containerRef, close, buttonRef, panelRef)


  return (
    <div ref={containerRef} className="relative">
      <IconButton
        ref={buttonRef}
        aria-label={t('history.open')}
        title={t('history.open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        active={open}
        onClick={() => setOpen((v) => !v)}
      >
        <HistoryIcon size={17} />
      </IconButton>

      {open && (
        <AnchoredMenuPanel
          anchorRef={buttonRef}
          panelRef={panelRef}
          role="dialog"
          aria-label={t('history.title')}
          className="w-[min(20rem,calc(100vw-1.5rem))]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-material-border px-3.5 py-3">
            <p className="truncate text-inshop-sm font-semibold text-foreground">{t('history.title')}</p>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={clearViewHistory}
                className="rounded-inshop-sm px-1.5 py-0.5 text-2xs text-foreground/55 transition-colors hover:bg-foreground/8 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t('history.clear')}
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-inshop-xs text-foreground/50">{t('history.empty')}</p>
          ) : (
            /* 목록이 길어져도 메뉴가 화면을 넘지 않도록 안에서만 구른다 */
            <ul aria-label={t('history.title')} className="max-h-[min(26rem,60vh)] overflow-y-auto py-1">
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
                      'flex min-w-0 flex-1 items-center gap-3 py-2 pl-3.5 pr-2 text-left',
                      'focus:outline-none focus-visible:bg-foreground/6'
                    )}
                  >
                    <ZoneBadge zone={entry.zone} />
                    <span className="min-w-0 flex-1 truncate text-inshop-sm font-semibold tabular-nums text-foreground">
                      {entry.projNo}-{entry.blockNo}
                    </span>
                  </button>
                  {/* ☆ — 이 줄을 즐겨찾기에 넣는다(사용자 확정) */}
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
