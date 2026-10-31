import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import type { FaultBay } from '../lib/bayEquipmentFaults'
import { linkWordOf } from '../lib/faultLinkWord'

/**
 * 점검이 필요한 장비 칩 — 종류 · 설비ID · 상태. 설비ID 는 현장이 부르는 이름이다.
 * 좁은 화면의 점검 필요 목록과 지도 핀·하이라이트의 hover 카드가 같은 모양을 쓴다.
 * 상태 낱말은 현황 화면과 같다(`linkWordOf` — 도장은 응답 없음).
 */
export function FaultEquipmentChips({ bay, className }: { bay: FaultBay; className?: string }) {
  const { t } = useTranslation()
  return (
    <span className={cn('flex flex-wrap gap-1', className)}>
      {bay.equipment.map((e) => (
        <span
          key={e.id}
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs',
            e.link === 'error' ? 'bg-status-unhealthy/20 text-white/90' : 'bg-status-degraded/20 text-white/85'
          )}
        >
          <span>{e.typeName}</span>
          <span className="font-mono text-white/55">{e.id}</span>
          <span
            className={cn('font-semibold', e.link === 'error' ? 'text-status-unhealthy' : 'text-status-degraded')}
          >
            {t(`dashboard.map.faultPanel.link.${linkWordOf(bay.process, e.link)}`)}
          </span>
        </span>
      ))}
    </span>
  )
}
