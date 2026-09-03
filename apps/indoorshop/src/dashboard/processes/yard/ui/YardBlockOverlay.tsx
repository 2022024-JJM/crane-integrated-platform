import { useTranslation } from '../../../shared/lib/i18n/useTranslation'
import { DraggableCard } from '../../../shared/ui/atoms/DraggableCard'
import { cn } from '../../../shared/lib/utils'
import { CloseIcon } from '../../../shared/ui/icons'
import { findLot } from '../api/yardRepository'
import type { YardBlock } from '../model/types'
import { formatUpdatedAt } from '../model/types'

interface YardBlockOverlayProps {
  block: YardBlock
  onClose: () => void
  className?: string
}

/**
 * 선택한 블록의 상세 — 맵 왼쪽 위에 박아 둔다.
 *
 * 블록을 따라다니게 하면 확대·이동할 때마다 패널이 화면을 헤엄치고, 결국 자기가
 * 가리키는 점을 덮는다. 자리를 고정해 두면 여러 블록을 연달아 눌러 비교할 때
 * 값이 **같은 자리에서 바뀌어** 차이가 눈에 들어온다.
 */
export function YardBlockOverlay({ block, onClose, className }: YardBlockOverlayProps) {
  const { t } = useTranslation()
  const lot = findLot(block.lot)

  const rows: [string, string][] = [
    [t('yard.detail.hull'), block.projNo],
    [t('yard.detail.block'), block.suffix ? `${block.blkNo} · ${block.suffix}` : block.blkNo],
    [
      t('yard.detail.lot'),
      block.lot ? (lot ? `${block.lot} · ${lot.useType ?? '-'}` : block.lot) : '-',
    ],
    ...(lot ? ([[t('yard.detail.lotDesc'), lot.description]] as [string, string][]) : []),
    ...(lot?.place ? ([[t('yard.detail.place'), lot.place]] as [string, string][]) : []),
    ...(lot?.wip ? ([[t('yard.detail.wip'), lot.wip]] as [string, string][]) : []),
    [t('yard.detail.coord'), `${block.lat.toFixed(5)}, ${block.lon.toFixed(5)}`],
    [t('yard.detail.updated'), formatUpdatedAt(block.updatedAt) ?? '-'],
    [t('yard.detail.source'), block.source ?? '-'],
  ]

  return (
    <DraggableCard
      cardKey="block"
      className={cn(
        'absolute left-3 top-3 w-64 animate-fade-in overflow-hidden rounded-inshop-lg glass-panel',
        className,
      )}
    >
      <div data-drag-handle className="flex items-center gap-1.5 border-b border-glass-border/70 px-2.5 py-2">
        <span className="font-mono text-inshop-xs font-semibold text-glass-accent">{block.id}</span>
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

      {!lot && block.lot && (
        <p className="border-b border-glass-border/70 px-2.5 py-1.5 text-2xs text-glass-degraded">
          {t('yard.detail.lotMissing')}
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
