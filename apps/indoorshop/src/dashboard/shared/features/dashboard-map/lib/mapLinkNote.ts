/**
 * 이 작업 위치가 지도에서 어떤 사정인지 — 없으면 null(정상, 아무 말도 하지 않는다).
 *
 * "연결 키가 아예 없음"과 "키는 있는데 지도에 그 지번이 없음"은 사용자에게 다른
 * 사실이다(PRD §7): 앞은 아직 매핑이 안 된 것이고, 뒤는 매핑이 **틀린** 것이다.
 * 어느 쪽이든 목록과 상세 이동은 그대로 두고 지도 표현만 포기한다.
 */
export function mapLinkNote(
  location: { yardLotCodes?: string[] },
  knownLots: Set<string>
): 'dashboard.map.locationNoMapKey' | 'dashboard.map.locationLotMissing' | null {
  const codes = location.yardLotCodes
  if (!codes?.length) return 'dashboard.map.locationNoMapKey'
  return codes.some((code) => knownLots.has(code)) ? null : 'dashboard.map.locationLotMissing'
}
