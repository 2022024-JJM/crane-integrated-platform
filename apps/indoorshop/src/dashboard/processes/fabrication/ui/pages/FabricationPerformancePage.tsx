import { FabricationPerformanceView } from '../FabricationPerformanceView'

/**
 * 가공 화면 = **실적** 하나 — 가공은 현황 없이 실적만 있어, 다른 공정의 [실적] 화면과 같은 틀로
 * 선다(사용자 확정): 조회 바(호선 · 블록)와 결과뿐이다. 탭 줄·제목은 두지 않는다.
 */
export function FabricationPerformancePage() {
  return <FabricationPerformanceView />
}
