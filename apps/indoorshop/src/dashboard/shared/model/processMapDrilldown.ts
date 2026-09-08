import type { InshopKey } from '../lib/i18n/keys'

/**
 * 전체 현황 지도의 **작업 위치 드릴다운** 계약
 * (`docs/PRD_전체현황_공정존_베이_드릴다운_개선.md` FR-3).
 *
 * 대시보드는 공정 → 공장 → **작업 위치** 순으로 내려간다. 그 마지막 단계의 데이터와
 * 상세 경로는 공정마다 다르고(조립은 베이·정반, 다른 공정은 아직 미확정), 공통 화면이
 * 그것을 알면 `shared` 가 특정 공정을 알게 된다. 그래서 공정 모듈이 이 계약으로 내고
 * 대시보드는 레지스트리(`getProcessMapDrilldown`)로만 읽는다.
 *
 * 지켜야 하는 의미(PRD FR-3):
 *  - 공정 모듈이 작업 위치의 **명칭·조회·상세 경로**를 소유한다.
 *  - `shared` 는 조립의 `Location` 타입이나 API 를 직접 import 하지 않는다.
 *  - `detailPath` 는 앱 내부 절대 경로이며 대시보드가 조합하거나 추론하지 않는다.
 *  - 생산 식별자를 표시명으로 대체하지 않는다.
 *  - provider 가 없는 공정은 오류가 아니라 "작업 위치 상세 미제공" 상태다.
 */

/** 작업 위치 하나 — 조립에서는 베이(정반) */
export interface ProcessMapLocation {
  id: string
  /** 이 위치가 속한 지도 공장 키 (`YardParcelFactory.name`) */
  parentFacilityKey: string
  /** 사람이 읽는 이름 (조립: `3번 베이`). 생산 식별자로 대체하지 않는다 */
  displayName: string
  /** 운영 식별자 (조립: 정반코드 `WORK_CNTR`/`JIG_CODE`). 값이 있을 때만 */
  locationCode?: string
  /** 상태 문구의 번역 키. 없으면 상태 줄을 만들지 않는다 — 가짜 기본값을 두지 않는다 */
  statusLabelKey?: InshopKey
  /** 이 위치가 차지하는 야드 지번 코드. 없으면 지도에서 강조할 자리가 없다 */
  yardLotCodes?: string[]
  /** 이 위치의 상세 화면 경로 (조립: `/indoorshop/zones/assembly/{factoryId}/{locationId}`) */
  detailPath: string
}

/**
 * 한 공장의 조회 결과.
 *
 * "이 공정이 모르는 공장"과 "아는 공장인데 위치가 없음"은 화면에서 다른 말을 해야 해서
 * (PRD §7 의 `지도 키가 지도 fixture 에 없음` vs `작업 위치가 없음`) 둘을 값으로 가른다.
 */
export type ProcessMapDrilldownResult =
  | {
      kind: 'ok'
      /** 이 공장의 공정 화면(공장 현황) 경로 — 없으면 `공장 현황 열기` 를 내지 않는다 */
      facilityPath: string | null
      locations: ProcessMapLocation[]
    }
  /** 이 공정 모듈이 소유하지 않는 공장 키 — 지도 공장 ↔ 공정 공장 매핑에 없다 */
  | { kind: 'unmapped' }

export interface ProcessMapDrilldownProvider {
  /** 이 공정이 작업 위치를 부르는 말 (조립: `베이(정반)`) — 공통 UI 가 그대로 쓴다 */
  locationNounKey: InshopKey
  /**
   * 공장 하나의 작업 위치 조회. 공장을 고른 **뒤에** 부르며(PRD FR-7 지연 조회),
   * 무거운 어댑터는 동적 import 로 끌어와 대시보드 초기 청크에 실리지 않게 한다.
   */
  fetchLocations: (parentFacilityKey: string) => Promise<ProcessMapDrilldownResult>
}
