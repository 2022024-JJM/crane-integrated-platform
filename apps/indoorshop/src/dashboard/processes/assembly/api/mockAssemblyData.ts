import type { Factory, FactoryHealth } from '../../../shared/entities/factory/model/types'
import type { Location, LocationStatus } from '../../../shared/entities/location/model/types'
import type { LidarBlockTransform } from '../../../shared/features/bay-viewer/model/lidarBlock'
import type { LidarSensor } from '../../../shared/features/bay-viewer/model/lidarSensor'
import { blocksWithCadModel } from '../../../shared/entities/vessel'
import { YARD_EQUIPMENT, equipmentLinkOf } from '../../../shared/entities/equipment'
import { ASSEMBLY_FACTORIES, type AssemblyUnitLevel } from './assemblyFactoryFixture'

/**
 * 조립 공장 마스터 (mock 뼈대 + 실데이터 구조).
 *
 * 공장 7곳과 각 공장의 BAY 구조는 **painting 야드 지번 데이터에서 파생**한 것이다
 * (`assemblyFactoryFixture.ts` — `scripts/build-assembly-factories-fixture.mjs` 생성물).
 * 센서·상태·블록배정 같은 실측 없는 값만 mock(결정론적 해시)으로 채운다 — 공장/BAY
 * 골격은 실데이터, 그 위에 얹는 계측값만 목업이다. 실연동 시 이 파일 대신 실제 조회를
 * `assemblyApi` 함수 몸통에 넣으면 되고, 공장/BAY 구조는 fixture 재생성으로 갱신한다.
 *
 * (예외 한 칸: PBS 5BAY 는 실측 스캔이다 — 여기서도 목업 정반으로 만들어 두지만,
 * `assemblyApi.fetchLocations` 가 그 한 칸을 실측 위치(`realScanData.REAL_LOCATION`)로
 * **교체**한다. 한때 실측이 GBS 공장을 통째 차지했으나 실제 위치 확인으로 베이 단위
 * 부착으로 바뀌었고, GBS 는 다른 공장과 같은 목업 공장이다.)
 */

const MOCK_FACTORY_SPECS = ASSEMBLY_FACTORIES

/** 문자열 기반 결정적 의사난수 — 렌더링마다 값이 흔들리지 않도록 */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 정반(베이) 하나의 화면 좌표계 위치 id — url-safe */
function locationId(factoryId: string, bayNo: number): string {
  return `${factoryId}-b${bayNo}`
}

/**
 * 베이별 블록 배정 — **어느 블록이 어느 정반에 있는지는 로스터가 정한다**
 * (`shared/entities/vessel`). 여기서는 그 배정에 3D 배치(placement)만 얹는다.
 *
 * 배치를 로스터에 두지 않는 이유: position/quaternion 은 이 뷰어의 좌표계 사정이지
 * 우주의 사실이 아니다. 반대로 호선·블록번호를 여기서 만들면 통합실적·의장이 모르는
 * 블록이 되어 화면끼리 이어지지 않는다(이 파일이 로스터를 읽게 된 이유).
 *
 * `placement` 가 없는 정반은 원점에 그대로 놓는다 — CAD 가 붙는 정반은 지금 다섯이고
 * 전부 아래에 적혀 있다.
 */
export interface BayBlockAssignment {
  projNo: string
  blkNo: string
  placement: LidarBlockTransform
  unitLevel: AssemblyUnitLevel
}

/** 정반별 3D 배치 — 블록 로컬 좌표(바닥 중심 원점)를 정반 좌표계에 놓는 transform */
const BAY_PLACEMENTS: Record<string, LidarBlockTransform> = {
  /* 2540-281·2543-642 의 정반 — 라이다가 실재하는 베이(8·6BAY)로 이동 (R9 시연:
     1~3BAY 는 도면상 라이다 0대라 헤드라인 CAD 블록이 '센서 없음'으로 보였다) */
  'asm-pbs-b8': { position: [0, 0, -4], quaternion: [0, 0.06, 0, 0.998] },
  'asm-pbs-b6': { position: [1, 0, 3], quaternion: [0, -0.05, 0, 0.999] },
  'asm-pbs-b4': { position: [0, 0, 2], quaternion: [0, 0, 0, 1] },
  'asm-nps-b2': { position: [-1, 0, -2], quaternion: [0, 0.09, 0, 0.996] },
  'asm-nps-b3': { position: [0, 0, 4], quaternion: [0, -0.07, 0, 0.998] },
}

const ORIGIN_PLACEMENT: LidarBlockTransform = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] }

/**
 * CAD 형상이 있는 로스터 블록만 정반에 앉힌다 — 형상 없는 블록을 배정하면 뷰어가
 * 빈 정반을 '재실'로 보여 공장 뷰와 베이 뷰가 어긋난다.
 */
export const bayBlockAssignments: Record<string, BayBlockAssignment> = Object.fromEntries(
  blocksWithCadModel().map((block) => {
    const berth = block.berth!
    return [
      berth.bayId,
      {
        projNo: block.projNo,
        blkNo: block.blockNo,
        placement: BAY_PLACEMENTS[berth.bayId] ?? ORIGIN_PLACEMENT,
        unitLevel: berth.unitLevel,
      } satisfies BayBlockAssignment,
    ]
  })
)

/**
 * 베이 상태 — CAD 모델이 배정된 베이는 '재실'(occupied). 나머지는 결정론적으로
 * 공석/미상만 준다 (형상 없는 베이를 '재실'로 두면 뷰어가 빈 정반을 재실로 보여
 * 공장 뷰와 베이 뷰가 어긋난다).
 */
function bayStatus(id: string): LocationStatus {
  if (bayBlockAssignments[id]) return 'occupied'
  return hashOf(`${id}-status`) % 2 === 0 ? 'empty' : 'unknown'
}

export const mockFactories: Factory[] = MOCK_FACTORY_SPECS.map((factory): Factory => {
  const occupied = factory.bays.some((bay) => bayBlockAssignments[locationId(factory.id, bay.bayNo)])
  const health: FactoryHealth = occupied
    ? 'healthy'
    : hashOf(`${factory.id}-health`) % 3 === 0
      ? 'degraded'
      : 'healthy'
  return {
    id: factory.id,
    name: factory.name,
    displayName: factory.name,
    assyShop: factory.assyShop,
    locationCount: factory.bays.length,
    health,
  }
})

export const mockLocations: Location[] = MOCK_FACTORY_SPECS.flatMap((factory) =>
  factory.bays.map((bay): Location => {
    const id = locationId(factory.id, bay.bayNo)
    const assignment = bayBlockAssignments[id]
    return {
      id,
      factoryId: factory.id,
      name: `${bay.bayNo}번 베이`,
      status: bayStatus(id),
      workCntr: bay.code,
      projNo: assignment?.projNo,
      blkNo: assignment?.blkNo,
      yardLots: bay.yardLots,
    }
  })
)

/** 스캔 시각 — 결정론적 (13:00~15:59 범위의 HH:MM). 시드는 **설비 ID** 다 */
function scanTimeOf(id: string): string {
  const h = 13 + (hashOf(`${id}-scan-h`) % 3)
  const m = hashOf(`${id}-scan-m`) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 조립 공장 id → 지도 공장 이름 — 설비 엔티티가 공장을 이름으로 부른다 */
const factoryNameById = new Map(MOCK_FACTORY_SPECS.map((factory) => [factory.id, factory.name]))

/** 정반 id(`{공장id}-b{베이번호}`) → 베이 번호 */
function bayNoOf(locationId: string): string {
  return locationId.split('-b').at(-1) ?? ''
}

/**
 * 정반의 LiDAR — **도면에서 이관된 실제 설비**를 쓴다.
 *
 * 예전에는 정반마다 `센서 1~8` 을 지어냈다(148대). 그런데 같은 조립 화면의 설비 상태 단과
 * 지도 마커는 이미 이관된 `LD-P01` 을 이름으로 부른다 — 한 라이다가 왼쪽 지도에서는
 * `LD-P01`, 오른쪽 정반 카드에서는 `센서 3` 이면 그 둘이 같은 것인지 화면을 오가며 다시
 * 판단해야 한다(`.work/연계매트릭스.md` Top4). 원천을 설비 엔티티 하나로 모은다.
 *
 * 상태도 같은 출처(`equipmentLinkOf`)를 따른다 — 예전의 '데모용 고정 고장'(첫 배정 정반의
 * 3번 센서 offline 등)은 그 설비의 실제 판정과 어긋나므로 함께 걷어냈다.
 *
 * 도면이 닿지 않은 베이는 **빈 목록**이다. 없는 센서를 지어내 대수를 채우지 않는다 —
 * 0대는 "여기엔 아직 라이다가 없다"는 사실이고, 그 자체가 정보다.
 */
export const mockLidarSensors: LidarSensor[] = mockLocations.flatMap((location) => {
  const factoryName = factoryNameById.get(location.factoryId)
  if (!factoryName) return []
  const bayNo = bayNoOf(location.id)
  return YARD_EQUIPMENT.filter(
    (equipment) =>
      equipment.typeId === 'LIDAR' && equipment.factory === factoryName && equipment.bay === bayNo
  ).map(
    (equipment): LidarSensor => ({
      id: equipment.id,
      locationId: location.id,
      /* 이름 = 설비ID. 화면마다 다른 별명을 붙이지 않는다 */
      name: equipment.id,
      status: equipmentLinkOf(equipment),
      lastScanAt: scanTimeOf(equipment.id),
    })
  )
})
