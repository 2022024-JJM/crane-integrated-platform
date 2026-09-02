import type { Factory, FactoryHealth } from '../../../shared/entities/factory/model/types'
import type { Location, LocationStatus } from '../../../shared/entities/location/model/types'
import type { LidarBlockTransform } from '../../../shared/features/bay-viewer/model/lidarBlock'
import type { LidarSensor } from '../../../shared/features/bay-viewer/model/lidarSensor'
import { ASSEMBLY_FACTORIES } from './assemblyFactoryFixture'

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
 * 베이별 실제 블록 모델 배정 (public/models/의 FBX 전처리 산출물과 대응).
 *  - placement: 블록 로컬 좌표(바닥 중심 원점)를 정반 좌표계에 놓는 transform
 *  - unitLevel: 'assembly' = 중조립품 단위 인식 / 'block' = 대조립 단위
 *
 * CAD 모델이 있는 데모 베이만 배정한다 — 나머지 베이는 공석/미상이라 형상이 없다.
 * 배정 베이의 unitLevel 은 그 베이의 파생 unitLevel(대조=block)과 일치시킨다:
 *  - PBS 1·2·4 BAY (소/중조) → 중조립품 데모 3종
 *  - NPS 2·3 BAY (대조)      → 대조립 블록 데모 2종
 */
export interface BayBlockAssignment {
  projNo: string
  blkNo: string
  placement: LidarBlockTransform
  unitLevel: 'assembly' | 'block'
}

export const bayBlockAssignments: Record<string, BayBlockAssignment> = {
  'asm-pbs-b1': {
    projNo: '2540',
    blkNo: '281',
    placement: { position: [0, 0, -4], quaternion: [0, 0.06, 0, 0.998] },
    unitLevel: 'assembly',
  },
  'asm-pbs-b2': {
    projNo: '2543',
    blkNo: '642',
    placement: { position: [1, 0, 3], quaternion: [0, -0.05, 0, 0.999] },
    unitLevel: 'assembly',
  },
  'asm-pbs-b4': {
    projNo: '2570',
    blkNo: '153',
    placement: { position: [0, 0, 2], quaternion: [0, 0, 0, 1] },
    unitLevel: 'assembly',
  },
  'asm-nps-b2': {
    projNo: '4391',
    blkNo: '154',
    placement: { position: [-1, 0, -2], quaternion: [0, 0.09, 0, 0.996] },
    unitLevel: 'block',
  },
  'asm-nps-b3': {
    projNo: '4392',
    blkNo: '133',
    placement: { position: [0, 0, 4], quaternion: [0, -0.07, 0, 0.998] },
    unitLevel: 'block',
  },
}

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

/** 스캔 시각 — 결정론적 (13:00~15:59 범위의 HH:MM) */
function scanTimeOf(id: string): string {
  const h = 13 + (hashOf(`${id}-scan-h`) % 3)
  const m = hashOf(`${id}-scan-m`) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 베이별 센서 수 — 재실(CAD 배정) 베이는 8대(장변 4×2), 나머지는 6대(3×2) */
function sensorCount(id: string): number {
  return bayBlockAssignments[id] ? 8 : 6
}

/**
 * 상태 데모용 결정론적 고장 — 배정 베이 중 첫째는 센서 3 offline, 둘째는 센서 1 error.
 * (목록 화면의 '점검 필요 센서' 집계가 항상 같은 값을 보이도록 고정한다.)
 */
const assignedIds = Object.keys(bayBlockAssignments)
const sensorOverrides: Record<string, Partial<LidarSensor>> = {
  [`${assignedIds[0]}-s3`]: { status: 'offline' },
  [`${assignedIds[1]}-s1`]: { status: 'error' },
}

export const mockLidarSensors: LidarSensor[] = mockLocations.flatMap((location) =>
  Array.from({ length: sensorCount(location.id) }, (_, i): LidarSensor => {
    const id = `${location.id}-s${i + 1}`
    return {
      id,
      locationId: location.id,
      name: `센서 ${i + 1}`,
      status: 'online',
      lastScanAt: scanTimeOf(location.id),
      ...sensorOverrides[id],
    }
  })
)
