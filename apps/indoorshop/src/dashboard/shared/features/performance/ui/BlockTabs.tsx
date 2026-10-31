import type { ReactNode } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import { FolderPanel } from '../../../ui/atoms/FolderTabs'
import { FavoriteToggle } from '../../favorites'
import type { HistoryZone } from '../../view-history'

/**
 * 고른 블록들의 탭 — 화면은 **지금 탭의 블록 하나만** 그린다(사용자 확정).
 *
 * 블록이 하나뿐이어도 탭을 세운다 — 지금 무엇을 보고 있는지가 조회 조건 바 밖에서도 읽혀야 한다.
 * 탭마다 × 로 닫는다 — 그 블록을 조회 조건에서 뺀다(`onClose`). ☆ 로 그 화면의 그 블록을 즐겨찾기에 넣는다. 마지막 탭을 닫으면 블록 선택이 빈다.
 * 탭은 통합실적·공정 [실적] 화면이 한 벌로 맞춘다(`useBlockQuery`).
 *
 * 모양은 현황 하위 탭과 같은 **폴더 탭**이다(사용자 확정) — 고른 탭과 그 아래 내용 칸(`children`)이
 * 한 테두리로 이어진다. 실적 내용은 문서형이라 판(뷰포트 표면)은 깔지 않고 테두리만 두른다.
 */
export function BlockTabs({
  projNo,
  blocks,
  active,
  onSelect,
  onClose,
  children,
  className,
  favoriteZone,
}: {
  projNo: string
  blocks: string[]
  active: string | null
  onSelect: (blockNo: string) => void
  onClose: (blockNo: string) => void
  /** 지금 탭의 블록 내용 — 폴더 탭 아래 칸에 선다 */
  children?: ReactNode
  className?: string
  /** 이 화면 — 주면 탭마다 ☆ 로 그 블록을 즐겨찾기에 넣고 뺀다 */
  favoriteZone?: HistoryZone
}) {
  const { t } = useTranslation()
  if (blocks.length === 0) return null
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <div role="tablist" aria-label={t('performance.filter.blockTabs')} className="relative z-10 flex flex-wrap items-end gap-1 px-3">
        {blocks.map((blockNo) => {
          const on = active === blockNo
          return (
            <div
              key={blockNo}
              className={cn(
                'flex items-center transition-colors',
                /* 고른 탭은 위·양옆을 두르고 1px 내려와 페이지 바탕으로 칸의 윗변을 덮는다 */
                on
                  ? '-mb-px rounded-t-inshop-lg border border-b-0 border-border bg-background pb-px text-accent'
                  : 'border border-transparent text-foreground/60 hover:text-foreground'
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onSelect(blockNo)}
                className="py-2.5 pl-5 pr-2 text-inshop-base font-semibold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <span className="font-medium text-foreground/50">{projNo}-</span>
                {blockNo}
              </button>
              {/* 이름 · 즐겨찾기 · 닫기는 눌러 맞히기 쉽게 크게 둔다(사용자 지적: 너무 작다) */}
              {favoriteZone && <FavoriteToggle zone={favoriteZone} projNo={projNo} blockNo={blockNo} size={18} className="size-8" />}
              <button
                type="button"
                aria-label={t('performance.filter.closeBlockTab', { block: blockNo })}
                title={t('performance.filter.closeBlockTab', { block: blockNo })}
                onClick={() => onClose(blockNo)}
                className="mr-2 grid size-8 place-items-center rounded text-inshop-xl leading-none text-foreground/55 hover:bg-surface-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      <FolderPanel surface={false} className="flex-1 gap-4 p-4">
        {children}
      </FolderPanel>
    </div>
  )
}
