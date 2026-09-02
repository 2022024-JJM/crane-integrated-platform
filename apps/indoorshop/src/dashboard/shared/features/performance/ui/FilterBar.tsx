import { useTranslation } from '../../../lib/i18n/useTranslation'
import { Button } from '../../../ui/atoms/Button'
import { Segmented, type SegmentedOption } from '../../../ui/atoms/Segmented'
import { CloseIcon } from '../../../ui/icons'
import type { BlockOption, ProcessFilter, Vessel } from '../model/types'

const PROCESS_OPTIONS: SegmentedOption<ProcessFilter>[] = [
  { value: 'all', labelKey: 'performance.process.all' },
  { value: 'fabrication', labelKey: 'performance.process.fabrication' },
  { value: 'assembly', labelKey: 'performance.process.assembly' },
  { value: 'outfitting', labelKey: 'performance.process.outfitting' },
  { value: 'painting', labelKey: 'performance.process.painting' },
]

/**
 * 조회 조건 바 (IPD-S01) — 호선(필수 select) + 블록 멀티선택(칩) + 공정 세그먼트.
 *
 * 블록은 재공 목록에서 복수 선택한다(v6 확정 — 부분 입력 대체). 칩에는 블록 No 와
 * 조립 공장 라벨을 병기한다. ⚠️ 재공 목록의 범위 규칙은 미확정(performanceApi 주석).
 */
export function FilterBar({
  vessels,
  vessel,
  onVesselChange,
  blockOptions,
  selectedBlocks,
  onToggleBlock,
  process,
  onProcessChange,
  onSearch,
  onReset,
}: {
  vessels: Vessel[]
  vessel: string
  onVesselChange: (projNo: string) => void
  blockOptions: BlockOption[]
  selectedBlocks: string[]
  onToggleBlock: (blockNo: string) => void
  process: ProcessFilter
  onProcessChange: (p: ProcessFilter) => void
  onSearch: () => void
  onReset: () => void
}) {
  const { t } = useTranslation()
  const remaining = blockOptions.filter((b) => !selectedBlocks.includes(b.blockNo))

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-inshop-lg border border-border bg-surface px-4 py-3">
      <label className="flex items-center gap-2 text-inshop-xs">
        <span className="text-foreground/60">{t('performance.filter.vessel')}</span>
        <select
          value={vessel}
          onChange={(e) => onVesselChange(e.target.value)}
          className="h-8 rounded-inshop-md border border-border bg-surface px-2 text-inshop-xs text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="">{t('performance.filter.vesselPlaceholder')}</option>
          {vessels.map((v) => (
            <option key={v.projNo} value={v.projNo}>
              {v.projNo}호 ({v.shipType})
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1.5 text-inshop-xs">
        <span className="text-foreground/60">{t('performance.filter.blocks')}</span>
        {selectedBlocks.map((blockNo) => {
          const option = blockOptions.find((b) => b.blockNo === blockNo)
          return (
            <button
              key={blockNo}
              type="button"
              onClick={() => onToggleBlock(blockNo)}
              aria-label={t('performance.filter.removeBlock', { block: blockNo })}
              className="inline-flex items-center gap-1 rounded-inshop-md border border-accent/40 bg-accent/8 px-2 py-1 text-inshop-xs text-accent transition-colors hover:border-accent"
            >
              <span className="font-medium tabular-nums">{blockNo}</span>
              {option && <span className="text-accent/70">{option.factory}</span>}
              <CloseIcon size={11} />
            </button>
          )
        })}
        <select
          value=""
          disabled={vessel === '' || remaining.length === 0}
          onChange={(e) => {
            if (e.target.value) onToggleBlock(e.target.value)
          }}
          aria-label={t('performance.filter.addBlock')}
          className="h-8 rounded-inshop-md border border-dashed border-border bg-surface px-2 text-inshop-xs text-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
        >
          <option value="">{t('performance.filter.addBlock')}</option>
          {remaining.map((b) => (
            <option key={b.blockNo} value={b.blockNo}>
              {b.blockNo} · {b.factory}
            </option>
          ))}
        </select>
      </div>

      <Segmented
        legend={t('performance.filter.process')}
        hideLegend
        value={process}
        options={PROCESS_OPTIONS}
        onChange={onProcessChange}
        size="sm"
      />

      <div className="ml-auto flex items-center gap-2">
        <Button variant="solid" size="sm" onClick={onSearch} disabled={vessel === ''}>
          {t('performance.filter.search')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset}>
          {t('performance.filter.reset')}
        </Button>
      </div>
    </div>
  )
}
