import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { colorOfProcess } from '../../../entities/yard-parcels'
import type { ProcessMapLocation } from '../../../model/processMapDrilldown'

/**
 * 고른 **베이**의 이름패 밑에 붙는 나가는 문 — 그 베이의 작업 위치 상세로 들어간다.
 *
 * 공장 단계의 `ZoneJumpButton` 과 같은 자리·같은 모습이되 목적지가 다르다: 저쪽은 그
 * 공정 화면의 공장(`?factory=`)이고, 이쪽은 공정 모듈이 준 **작업 위치 경로**
 * (`ProcessMapLocation.detailPath`, 조립: `/indoorshop/zones/assembly/{공장}/{정반}`)다. 주소를
 * 여기서 조합하지 않는 것은 드릴다운 계약 그대로다 — 지도는 그 공정의 라우트를 모른다.
 *
 * 갈 곳이 없는 베이(지번이 겹치는 작업 위치가 없음)에서는 호출부가 이 문을 세우지
 * 않는다. 그 사정은 왼쪽 상세 카드가 말한다(`bayNoLinkedLocation`) — 안 열리는 문은
 * 없는 문보다 나쁘다는 규칙이 여기서도 같다.
 */
export function BayJumpButton({
  process,
  location,
}: {
  /** 이 베이의 공정 — 글자가 아니라 **색**으로만 쓴다(패의 규칙과 같다) */
  process: string | null
  /** 이 베이와 지번이 겹치는 작업 위치 — 이름과 경로의 원천 */
  location: ProcessMapLocation
}) {
  const { t } = useTranslation()
  const color = process ? colorOfProcess(process) : '#9a9890'
  return (
    <Link
      to={location.detailPath}
      className="flex w-full items-center justify-between gap-2 rounded-inshop-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-inshop-xs font-semibold text-white/90 transition-colors hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <span className="truncate">
        {t('dashboard.map.bayOpenLocation', { name: location.displayName })}
      </span>
      <span aria-hidden="true" className="shrink-0">
        →
      </span>
    </Link>
  )
}
