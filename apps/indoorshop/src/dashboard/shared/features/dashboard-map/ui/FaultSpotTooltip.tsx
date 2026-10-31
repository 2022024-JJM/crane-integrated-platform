import { useTranslation } from '../../../lib/i18n/useTranslation'
import { colorOfProcess } from '../../../entities/yard-parcels'
import type { FaultBay } from '../lib/bayEquipmentFaults'
import { FaultEquipmentChips } from './FaultEquipmentChips'

/** 카드 너비(px) — 오른쪽 가장자리에서 커서 왼쪽으로 뒤집는 기준 */
const WIDTH = 320

/**
 * 지도의 점검 필요 **핀·하이라이트에 손을 얹으면** 뜨는 작은 카드 — 어느 공장의 어느 베이인지와
 * 점검이 필요한 장비(종류 · 설비ID · 상태). 커서 옆에 붙고, 지도 오른쪽 끝에서는 왼쪽으로
 * 뒤집는다. 클릭을 막지 않는다(pointer-events-none) — 손 아래 지도는 그대로 눌린다.
 */
export function FaultSpotTooltip({
  bay,
  x,
  y,
  boxWidth,
}: {
  bay: FaultBay
  /** 지도 상자 기준 커서 좌표 */
  x: number
  y: number
  boxWidth: number
}) {
  const { t } = useTranslation()
  const flip = x + 16 + WIDTH > boxWidth - 8
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 animate-fade-in rounded-inshop-lg border border-white/15 bg-[#0b0e12]/95 p-3 text-white shadow-[0_14px_36px_rgba(0,0,0,0.45)]"
      style={{ left: flip ? x - 16 - WIDTH : x + 16, top: y + 16, width: WIDTH }}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorOfProcess(bay.process) }} />
        <span className="min-w-0 truncate text-inshop-xs text-white/65">{bay.factory}</span>
        <span className="shrink-0 text-inshop-base font-semibold">{bay.label}</span>
      </div>
      <p className="mt-2 text-2xs font-medium text-status-unhealthy">
        {t('dashboard.map.equipmentFault', { count: bay.equipment.length })}
      </p>
      <FaultEquipmentChips bay={bay} className="mt-1.5" />
    </div>
  )
}
