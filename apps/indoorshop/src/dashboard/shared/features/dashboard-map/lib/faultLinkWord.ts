import type { FaultEquipment } from './bayEquipmentFaults'

/**
 * 장애 상태의 낱말 키(`dashboard.map.faultPanel.link.*`) — **그 공정 현황 화면이 쓰는 말 그대로**.
 * 목록에서 본 말과 줄을 눌러 연 현황 창의 말이 다르면 같은 장애를 두 가지로 부르게 된다.
 * 오류는 어디서나 '통신 오류', 끊김은 조립·의장 현황이 '오프라인', 도장 현황(Modbus
 * 무응답)이 '응답 없음' 이다. 오른쪽 점검 필요 목록과 베이 카드의 목록이 함께 쓴다.
 */
export function linkWordOf(
  process: string,
  link: FaultEquipment['link']
): 'offline' | 'error' | 'timeout' {
  if (link === 'offline' && process === '도장') return 'timeout'
  return link
}
