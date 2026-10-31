import { useTranslation } from '../../../lib/i18n/useTranslation'
import { Button } from '../../../ui/atoms/Button'
import { Segmented, type SegmentedOption } from '../../../ui/atoms/Segmented'
import type { BlockOption, ProcessFilter, Vessel } from '../model/types'
import { BlockPicker } from './BlockPicker'

const PROCESS_OPTIONS: SegmentedOption<ProcessFilter>[] = [
  { value: 'all', labelKey: 'performance.process.all' },
  { value: 'fabrication', labelKey: 'performance.process.fabrication' },
  { value: 'assembly', labelKey: 'performance.process.assembly' },
  { value: 'outfitting', labelKey: 'performance.process.outfitting' },
  { value: 'painting', labelKey: 'performance.process.painting' },
]

/**
 * 조회 조건 바 (IPD-S01) — 호선(필수 select) + 블록 선택 버튼 + 공정 세그먼트.
 *
 * 블록은 '블록 선택' 버튼이 여는 목록에서 **누를 때마다 탭으로 하나씩 더한다**(사용자 확정 — 예전 select·
 * 체크박스를 대체, 최대 10개). 호선을 고르면 블록은 비어 있다. 고른 블록들은 아래 블록 탭(`BlockTabs`)으로 선다. 항목에는 블록 No 와
 * 조립 공장 라벨을 병기한다. ⚠️ 재공 목록의 범위 규칙은 미확정(performanceApi 주석).
 *
 * 공정 화면 안에 들어가면(예: 조립 실적) 공정은 이미 정해져 있어 세그먼트를 감춘다(`hideProcess`).
 *
 * 조회 버튼은 없다 — 호선·공정은 고르는 즉시, 블록은 선택 창의 '확인' 으로 조회한다(사용자 확정).
 */
export function FilterBar({
  vessels,
  vessel,
  onVesselChange,
  blockOptions,
  selectedBlocks,
  onBlocksApply,
  process,
  onProcessChange,
  onReset,
  hideProcess = false,
}: {
  vessels: Vessel[]
  vessel: string
  onVesselChange: (projNo: string) => void
  blockOptions: BlockOption[]
  /** 조회된 블록들 — 비면 아직 고르지 않음(호선 미선택·목록 로딩) */
  selectedBlocks: string[]
  /** 블록 선택 창의 확인 — 체크한 블록들이 탭이 된다 */
  onBlocksApply: (blocks: string[]) => void
  process: ProcessFilter
  onProcessChange: (p: ProcessFilter) => void
  onReset: () => void
  /** 공정 세그먼트를 감춘다 — 한 공정 화면 안에서 쓸 때 */
  hideProcess?: boolean
}) {
  const { t } = useTranslation()

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

      <BlockPicker
        options={blockOptions}
        selected={selectedBlocks}
        disabled={vessel === '' || blockOptions.length === 0}
        onApply={onBlocksApply}
      />

      {!hideProcess && (
        <Segmented
          legend={t('performance.filter.process')}
          hideLegend
          value={process}
          options={PROCESS_OPTIONS}
          onChange={onProcessChange}
          size="sm"
        />
      )}

      {/* 초기화는 조건들 바로 뒤에 왼쪽 정렬로 선다(사용자 확정) */}
      <Button variant="ghost" size="sm" onClick={onReset}>
        {t('performance.filter.reset')}
      </Button>
    </div>
  )
}
