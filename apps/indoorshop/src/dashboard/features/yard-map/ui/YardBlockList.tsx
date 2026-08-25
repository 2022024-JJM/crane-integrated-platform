import { memo } from 'react'
import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { cn } from '../../../shared/lib/utils'
import { findLot } from '../../../entities/yard/api/yardRepository'
import type { YardBlock } from '../../../entities/yard/model/types'
import { formatUpdatedAt } from '../../../entities/yard/model/types'

interface YardBlockListProps {
  blocks: YardBlock[]
  selectedBlockId: string | null
  onSelectBlock: (blockId: string) => void
  onHoverLot?: (lot: string | null) => void
  className?: string
}

/**
 * 야드에 서 있는 블록 목록.
 *
 * 맵은 "어디에 있는가"를 답하고 목록은 "무엇이 있는가"를 답한다 — 둘은 같은 선택을
 * 공유한다. 목록에서 고르면 맵이 그 자리로 가고, 맵에서 고르면 목록이 그 줄로 구른다.
 *
 * 669건을 한 번에 그린다. 가상 스크롤을 넣지 않은 이유는 줄 하나가 DOM 노드 대여섯
 * 개뿐이라 4천 노드 수준이고, 필터를 걸면 대개 수십 건으로 줄기 때문이다.
 */
export const YardBlockList = memo(function YardBlockList({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onHoverLot,
  className,
}: YardBlockListProps) {
  const { t } = useTranslation()

  if (blocks.length === 0) {
    return (
      <p className={cn('px-1 py-8 text-center text-inshop-sm text-foreground/54', className)}>
        {t('yard.list.empty')}
      </p>
    )
  }

  return (
    <ul className={cn('space-y-1', className)}>
      {blocks.map((block) => {
        const lot = findLot(block.lot)
        const selected = block.id === selectedBlockId
        return (
          <li key={block.id}>
            <button
              type="button"
              ref={
                selected
                  ? (node) => node?.scrollIntoView({ block: 'nearest' })
                  : undefined
              }
              onClick={() => onSelectBlock(block.id)}
              onMouseEnter={() => onHoverLot?.(block.lot ?? null)}
              onMouseLeave={() => onHoverLot?.(null)}
              className={cn(
                'flex w-full flex-col gap-0.5 rounded-inshop-md border px-2.5 py-2 text-left transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                selected
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-accent/50 hover:bg-foreground/4',
              )}
            >
              <span className="flex items-baseline gap-2">
                <span
                  className={cn(
                    'font-mono text-inshop-xs font-semibold',
                    selected ? 'text-accent' : 'text-foreground',
                  )}
                >
                  {block.id}
                </span>
                <span className="ml-auto shrink-0 font-mono text-2xs text-foreground/54 tabular-nums">
                  {formatUpdatedAt(block.updatedAt) ?? '-'}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-mono text-2xs text-foreground/68">{block.lot ?? '-'}</span>
                <span className="min-w-0 flex-1 truncate text-2xs text-foreground/54">
                  {lot?.description ?? t('yard.list.unknownLot')}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
})
