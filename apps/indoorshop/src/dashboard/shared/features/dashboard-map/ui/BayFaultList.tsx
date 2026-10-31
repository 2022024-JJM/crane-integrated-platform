import { useTranslation } from '../../../lib/i18n/useTranslation'
import { cn } from '../../../lib/utils'
import type { FaultEquipment } from '../lib/bayEquipmentFaults'
import { linkWordOf } from '../lib/faultLinkWord'
import { AllClearIcon, ListPlaceholder } from './ListPlaceholder'

/*
 * 베이 카드 — 작업 목록 아래의 **점검 필요** 목록.
 *
 * 이 베이에서 손봐야 할 설비를 한 줄씩 늘어놓는다(종류 · 설비ID · 상태). 줄을 누르면 그
 * 설비를 짚은 채로 이 베이의 현황을 창으로 띄운다 — 오른쪽 점검 필요 목록의 줄과 같은
 * 착지다. 상태 낱말도 그 목록과 같다(`linkWordOf` — 현황 화면이 쓰는 말).
 *
 * 없으면 **없다고 말한다**(플레이스홀더 상자) — 목록이 사라지면 "다 정상"과 "아직 안 불러옴"이 같아진다.
 */
export function BayFaultList({
  process,
  equipment,
  onOpen,
  className,
}: {
  /** 이 베이의 공정 — 상태 낱말을 그 공정 현황 화면에 맞춘다 */
  process: string
  equipment: readonly FaultEquipment[]
  /** 줄 클릭 — 그 설비를 짚은 현황 창 열기 */
  onOpen: (equipment: FaultEquipment) => void
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div className={className}>
      <p className="mb-1.5 px-1 text-inshop-sm font-medium text-white/70">
        {t('dashboard.map.bayFaults.title')}
        {equipment.length > 0 && (
          <span className="ml-1.5 tabular-nums text-status-unhealthy">{equipment.length}</span>
        )}
      </p>
      {equipment.length === 0 ? (
        <ListPlaceholder icon={<AllClearIcon />}>{t('dashboard.map.bayFaults.empty')}</ListPlaceholder>
      ) : (
        <ul className="space-y-1.5">
          {equipment.map((item) => {
            const error = item.link === 'error'
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  title={t('dashboard.map.bayFaults.openHint', { equipment: item.id })}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-inshop-lg border px-3 py-2 text-left transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                    error
                      ? 'border-status-unhealthy/40 bg-status-unhealthy/10 hover:bg-status-unhealthy/20'
                      : 'border-status-degraded/40 bg-status-degraded/10 hover:bg-status-degraded/20'
                  )}
                >
                  <span className="shrink-0 text-inshop-sm text-white/75">{item.typeName}</span>
                  <span className="font-mono text-inshop-base font-semibold text-white">{item.id}</span>
                  <span
                    className={cn(
                      'ml-auto shrink-0 text-inshop-sm font-semibold',
                      error ? 'text-status-unhealthy' : 'text-status-degraded'
                    )}
                  >
                    {t(`dashboard.map.faultPanel.link.${linkWordOf(process, item.link)}`)}
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-white/40">
                    ›
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
