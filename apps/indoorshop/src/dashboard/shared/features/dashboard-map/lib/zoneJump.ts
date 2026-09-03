import { drilldownHref, YARD_DRILLDOWN } from '../../../lib/drilldownUrl'

/*
 * 총괄('/')에서 공정 화면으로 **넘어가는 문**의 주소 계약.
 *
 * 드릴인한 공장 문맥 그대로 그 공정의 맵 화면에 착지한다 — `?factory=` 로 공장을
 * 실어 보내면 도착 화면이 그 공장을 연 채로 서고, 카메라는 cameraHandoff 가 잇는다.
 * "그 공정 페이지에서 방금 그 공장을 클릭한 느낌"이 이 둘의 합이다.
 */

/**
 * 맵 진입 화면이 실제로 있는 공정존 — 여기 없는 공정(가공: Legacy 연동 중심이라 맵
 * 화면이 없다)은 문을 만들지 않는다. 안 열리는 문은 없는 문보다 나쁘다.
 */
const ZONES_WITH_MAP_ENTRY: Record<string, string> = {
  조립: 'assembly',
  의장: 'outfitting',
  도장: 'painting',
}

/**
 * 이 공장의 공정 화면으로 가는 주소. 갈 화면이 없으면(가공·미지의 공정) null —
 * 호출부는 null 이면 버튼 자체를 그리지 않는다.
 */
export function zoneJumpHref(process: string | null, factory: string): string | null {
  if (!process) return null
  const zoneId = ZONES_WITH_MAP_ENTRY[process]
  if (!zoneId) return null
  return drilldownHref(`/zones/${zoneId}`, '', { ...YARD_DRILLDOWN, factory })
}
