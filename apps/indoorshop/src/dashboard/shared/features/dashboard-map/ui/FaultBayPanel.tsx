import { useId, useState } from 'react'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { colorOfProcess } from '../../../entities/yard-parcels'
import { cn } from '../../../lib/utils'
import type { FaultBay } from '../lib/bayEquipmentFaults'
import { FaultEquipmentChips } from './FaultEquipmentChips'

/*
 * 야드 맵 오른쪽 — **점검이 필요한 베이** 목록.
 *
 * 공장을 하나씩 눌러 봐야 장애를 알 수 있으면, 장애가 있는 공장을 모르는 사람은 끝내
 * 못 찾는다. 그래서 야드 전체의 장애 베이를 한곳에 모은다. 줄을 누르면 그 베이로 들어가고
 * (지도 클릭과 같은 계단 — 카메라가 날아가고 베이 카드가 열린다), 손을 얹으면 지도에서
 * 그 베이가 어디인지 밝힌다(`onHoverBay` → 지도 `spotLots`).
 *
 * 장애가 없으면 **없다고 말한다** — 패널이 사라지면 "다 정상"과 "아직 안 불러옴"이 같아진다.
 *
 * **처음에는 접혀 있다** — 머리(⚠ 점검 필요 · 수)만 남아 지도를 가리지 않고, 수가 곧 "볼
 * 게 있다"는 신호다. 머리를 누르면 펴지고 다시 누르면 접힌다. 접을 때는 지도에 짚어 둔
 * 칸도 함께 거둔다(목록이 사라졌는데 핀만 남지 않게).
 */
export function FaultBayPanel({
  bays,
  selectedBayId,
  onOpenBay,
  onHoverBay,
  className,
}: {
  bays: readonly FaultBay[]
  /** 지금 열린 베이 — 그 줄을 눌린 모양으로 */
  selectedBayId: string | null
  onOpenBay: (bay: FaultBay) => void
  onHoverBay: (bay: FaultBay | null) => void
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const listId = useId()

  const toggle = () => {
    if (open) onHoverBay(null)
    setOpen(!open)
  }

  return (
    <section
      aria-label={t('dashboard.map.faultPanel.title')}
      className={cn(
        'pointer-events-auto flex max-h-full min-h-0 flex-col overflow-hidden rounded-inshop-xl border border-white/12 bg-[#0b0e12]/95 text-white shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur-xl',
        /* 접힌 동안은 머리만한 크기로 — 오른쪽 위에 작게 붙는다 */
        open ? 'w-[23rem] max-w-full' : 'w-fit',
        className
      )}
    >
      <div className="h-0.5 w-full shrink-0 bg-status-unhealthy" />
      {/* 머리 — 가장자리 여백이 드래그 손잡이, 안쪽 버튼이 접기/펴기 */}
      <div data-drag-handle className="flex shrink-0 p-1">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={listId}
          title={t(open ? 'dashboard.map.faultPanel.collapse' : 'dashboard.map.faultPanel.expand')}
          className="flex flex-1 items-center gap-2 rounded-inshop-lg px-3 py-2.5 text-left transition-colors hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <span aria-hidden="true" className="text-status-unhealthy">
            ⚠
          </span>
          <h3 className="text-inshop-sm font-semibold">{t('dashboard.map.faultPanel.title')}</h3>
          <span className="ml-auto rounded-full bg-status-unhealthy/20 px-2 py-0.5 text-inshop-xs font-semibold tabular-nums text-status-unhealthy">
            {bays.length}
          </span>
          <span
            aria-hidden="true"
            className={cn('text-inshop-xs text-white/55 transition-transform', open && 'rotate-180')}
          >
            ▾
          </span>
        </button>
      </div>

      {!open ? null : bays.length === 0 ? (
        <p id={listId} className="px-4 pb-4 text-inshop-sm text-white/55">
          {t('dashboard.map.faultPanel.empty')}
        </p>
      ) : (
        <ul
          id={listId}
          className="scroll-thin scroll-shadow-y min-h-0 flex-1 divide-y divide-white/8 overflow-y-auto px-2 pb-2"
          onMouseLeave={() => onHoverBay(null)}
        >
          {bays.map((bay) => {
            const selected = bay.bayId === selectedBayId
            return (
              <li key={bay.bayId}>
                <button
                  type="button"
                  onClick={() => onOpenBay(bay)}
                  onMouseEnter={() => onHoverBay(bay)}
                  onFocus={() => onHoverBay(bay)}
                  onBlur={() => onHoverBay(null)}
                  title={t('dashboard.map.faultPanel.openHint', {
                    factory: bay.factory,
                    bay: bay.label,
                  })}
                  className={cn(
                    'flex w-full flex-col gap-1.5 rounded-inshop-md px-2 py-2.5 text-left transition-colors',
                    'hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                    selected && 'bg-status-unhealthy/15 ring-1 ring-inset ring-status-unhealthy/50'
                  )}
                >
                  <span className="flex w-full items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorOfProcess(bay.process) }}
                    />
                    <span className="min-w-0 truncate text-inshop-xs text-white/65">{bay.factory}</span>
                    <span className="shrink-0 text-inshop-sm font-semibold">{bay.label}</span>
                    {/* 장애 수는 적지 않는다 — 아래 설비 칩이 무엇이 몇 대인지 말한다 */}
                    <span aria-hidden="true" className="ml-auto shrink-0 text-white/40">
                      ›
                    </span>
                  </span>
                  {/* 무엇이 아픈가 — 종류 · 설비ID · 상태. 설비ID 는 현장이 부르는 이름이다 */}
                  <FaultEquipmentChips bay={bay} className="pl-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
