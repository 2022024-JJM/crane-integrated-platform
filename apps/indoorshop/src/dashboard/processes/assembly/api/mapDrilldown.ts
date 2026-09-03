import type { Location } from '../../../shared/entities/location/model/types'
import { LOCATION_STATUS_META } from '../../../shared/entities/location/model/types'
import type {
  ProcessMapDrilldownResult,
  ProcessMapLocation,
} from '../../../shared/model/processMapDrilldown'
import { ASSEMBLY_FACTORIES } from './assemblyFactoryFixture'
import { fetchLocations } from './assemblyApi'

/**
 * 조립 어댑터 — 조립 `Location` 을 전체 현황 지도의 공통 작업 위치 계약으로 옮긴다
 * (`docs/PRD_전체현황_공정존_베이_드릴다운_개선.md` FR-4).
 *
 * | 공통 필드 | 조립 원천 | 규칙 |
 * |---|---|---|
 * | `id` | `Location.id` | 그대로 |
 * | `parentFacilityKey` | 지도 공장 키 | 아래 매핑으로 조립 `Factory.id` 와 이은 뒤 |
 * | `displayName` | `Location.name` | 그대로 (`3번 베이`) |
 * | `locationCode` | `Location.workCntr` | 정반코드(`JIG_CODE`) — 있을 때만 |
 * | 상태 | `Location.status` | 기존 enum 의 번역 키로 (`LOCATION_STATUS_META`) |
 * | `yardLotCodes` | `Location.yardLots` | 선택적 — 없으면 지도 강조 없음 |
 * | `detailPath` | 기존 라우트 | `/indoorshop/zones/assembly/{factoryId}/{locationId}` |
 *
 * 변환은 **조립 안에서만** 한다 — `shared` 는 조립의 `Location` 을 모른다(PRD §8).
 */

/**
 * 지도 공장 키(`YardParcelFactory.name`) → 조립 `Factory.id` 의 **명시적** 매핑.
 *
 * ⚠️ **non-production.** PRD FR-4 의 요구대로 공장 이름 문자열을 그대로 조립 API 에
 * 넘기지 않고 여기서 한 번 끊는다. 지금 두 이름이 같아 보이는 것은 두 fixture 가 같은
 * painting 원본에서 나왔기 때문이지 운영 공장 마스터가 그렇다는 뜻이 아니다 — 운영
 * 마스터가 확정되면 **이 표만** 갈아 끼운다.
 *
 * 실측 데이터셋은 PBS 5BAY 에 베이 단위로 붙어 있다 — 지도 키 'PBS' 로 들어가면
 * 정반 목록에 실측 정반(asm-pbs-b5)이 목업 정반들과 같은 줄로 나온다 (`realScanData.ts`).
 * GBS 는 다른 조립 공장과 같은 목업이다.
 */
export const ASSEMBLY_FACTORY_ID_BY_MAP_KEY: Readonly<Record<string, string>> =
  Object.fromEntries(ASSEMBLY_FACTORIES.map((factory) => [factory.name, factory.id]))

/** 조립 공장 현황(공장 전체 정반) 경로 */
function facilityPathOf(factoryId: string): string {
  return `/indoorshop/zones/assembly/${factoryId}`
}

/** 조립 정반현황 경로 — 기존 라우트를 그대로 쓴다(새 상세 화면을 만들지 않는다) */
function detailPathOf(factoryId: string, locationId: string): string {
  return `/indoorshop/zones/assembly/${factoryId}/${locationId}`
}

/** 조립 `Location` 한 건 → 공통 작업 위치 */
export function toMapLocation(
  location: Location,
  parentFacilityKey: string
): ProcessMapLocation {
  return {
    id: location.id,
    parentFacilityKey,
    displayName: location.name,
    /* 빈 문자열은 코드가 아니라 "없음" 이다 — 빈 칩을 만들지 않도록 여기서 떨군다 */
    locationCode: location.workCntr || undefined,
    statusLabelKey: LOCATION_STATUS_META[location.status].labelKey,
    /* 빈 배열은 "지도에 걸 자리가 없음" 과 같으므로 없는 것으로 둔다 */
    yardLotCodes: location.yardLots?.length ? [...location.yardLots] : undefined,
    detailPath: detailPathOf(location.factoryId, location.id),
  }
}

/**
 * 지도 공장 하나의 조립 베이(정반) 목록.
 *
 * 매핑에 없는 공장 키는 오류가 아니라 `unmapped` 다 — 대시보드가 "이 공장은 조립
 * 작업 위치를 제공하지 않는다"고 말할 수 있어야 하기 때문이다(PRD §7).
 */
export async function fetchAssemblyMapLocations(
  parentFacilityKey: string
): Promise<ProcessMapDrilldownResult> {
  const factoryId = ASSEMBLY_FACTORY_ID_BY_MAP_KEY[parentFacilityKey]
  if (!factoryId) return { kind: 'unmapped' }

  const locations = await fetchLocations(factoryId)
  return {
    kind: 'ok',
    facilityPath: facilityPathOf(factoryId),
    locations: locations.map((location) => toMapLocation(location, parentFacilityKey)),
  }
}
