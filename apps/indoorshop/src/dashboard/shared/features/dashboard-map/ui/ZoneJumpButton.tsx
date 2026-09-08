import { Link } from 'react-router-dom'
import { useTranslation } from '../../../lib/i18n/useTranslation'
import { colorOfProcess } from '../../../entities/yard-parcels'
import { zoneJumpHref } from '../lib/zoneJump'

/**
 * '/' → 공정 화면 점프 버튼 — 드릴인한 공장 문맥을 그대로 실어 보낸다.
 *
 * 주소는 zoneJumpHref(드릴다운 계약), 카메라는 클릭 순간의 화각을 stash(cameraHandoff).
 * 그 공정 화면이 `?factory=` 를 읽어 공장을 연 채로 서므로, 사용자에게는 "그 공정
 * 페이지에서 방금 그 공장을 클릭한" 연속 동작으로 읽힌다. 갈 화면이 없는 공정(가공)은
 * 버튼 자체가 서지 않는다 — 안 열리는 문은 없는 문보다 나쁘다.
 */
export function ZoneJumpButton({
  process,
  factory,
  onStash,
}: {
  process: string | null
  factory: string
  /** 떠나기 직전의 카메라를 승계 저장소에 맡긴다 (cameraHandoff) */
  onStash: () => void
}) {
  const { t } = useTranslation()
  const href = zoneJumpHref(process, factory)
  if (!href) return null
  const color = process ? colorOfProcess(process) : '#9a9890'
  return (
    <Link
      to={href}
      onClick={onStash}
      className="flex w-full items-center justify-between gap-2 rounded-inshop-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-inshop-xs font-semibold text-white/90 transition-colors hover:bg-white/[0.12] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <span className="truncate">{t('dashboard.map.openZone', { name: process })}</span>
      <span aria-hidden="true" className="shrink-0">→</span>
    </Link>
  )
}
