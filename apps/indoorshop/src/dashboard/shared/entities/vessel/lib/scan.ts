import type { AssyScanFact } from '../model/types'

/**
 * **실측 정합 품질을 수치로 옮기는 한 곳** (R31).
 *
 * 같은 정합 결과를 두 화면이 각자 환산하면 같은 덩이를 두고 실측 뷰는 '93%', 통합실적은
 * '89%' 를 적게 된다 — 사용자는 그것을 반올림 차이가 아니라 **두 화면이 다른 데이터를
 * 본다**로 읽는다. 그래서 환산식을 엔티티에 두고 양쪽이 부른다.
 *
 * 하한(0.55)·상한(0.99)은 표시용이다: 오차가 0 이어도 100% 확신이라 적지 않고, 아주
 * 큰 오차에서도 '정합되긴 했다'는 사실은 남는다(정합 자체가 실패한 덩이는 애초에
 * 데이터셋에 없다).
 */
export function scanConfidenceOf(fitErrorCm: number | undefined): number {
  if (fitErrorCm == null) return 0.8
  return Math.max(0.55, Math.min(0.99, 1 - fitErrorCm / 100))
}

/** 표면일치(%) — 화면·이벤트 문구가 쓰는 정수 표기. 환산은 위 한 곳에서만 한다 */
export function surfaceMatchPctOf(scan: AssyScanFact | undefined): number {
  return Math.round(scanConfidenceOf(scan?.fitErrorCm) * 100)
}

/**
 * ASSY_NO → 실측 자산의 CAD 인스턴스 이름 (`5510-553-FR103C` → `5510_553_FR103C`).
 *
 * 데이터셋은 이름을 `_` 로 잇고 로스터·통합실적은 ASSY_NO 를 `-` 로 잇는다. 두 표기를
 * 잇는 규칙이 화면마다 흩어지면 어느 쪽이 정본인지 모르게 되므로 여기 한 줄로 둔다.
 */
export function scanMeshNameOf(assyNo: string): string {
  return assyNo.replace(/-/g, '_')
}

/** 반대 방향 — 실측 자산의 CAD 인스턴스 이름을 ASSY_NO 로 (`5510_553_FR103C` → `5510-553-FR103C`) */
export function assyNoOfScanMesh(meshName: string): string {
  return meshName.replace(/_/g, '-')
}
