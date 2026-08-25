import type { Factory } from '../../../shared/entities/factory/model/types'
import type { Location } from '../../../shared/entities/location/model/types'
import type { LidarBlockTransform } from '../model/lidarBlock'
import type { LidarSensor } from '../model/lidarSensor'

export const mockFactories: Factory[] = [
  {
    id: 'factory-a',
    name: '조립 1공장',
    displayName: '조립 1공장',
    assyShop: 'A31',
    locationCount: 4,
    health: 'healthy',
  },
  {
    id: 'factory-b',
    name: '조립 2공장',
    displayName: '조립 2공장',
    assyShop: 'A32',
    locationCount: 3,
    health: 'degraded',
  },
]

/**
 * 베이별 실제 블록 모델 배정 (public/models/의 FBX 전처리 산출물과 대응).
 *  - placement: 블록 로컬 좌표(바닥 중심 원점)를 정반 좌표계에 놓는 transform
 *  - unitLevel: 'assembly' = 중조립품 단위 인식 (조립 1공장) / 'block' = 대조립 단위 (조립 2공장)
 */
export interface BayBlockAssignment {
  projNo: string
  blkNo: string
  placement: LidarBlockTransform
  unitLevel: 'assembly' | 'block'
}

export const bayBlockAssignments: Record<string, BayBlockAssignment> = {
  'a-1': {
    projNo: '2540',
    blkNo: '281',
    placement: { position: [0, 0, -4], quaternion: [0, 0.06, 0, 0.998] },
    unitLevel: 'assembly',
  },
  'a-2': {
    projNo: '2543',
    blkNo: '642',
    placement: { position: [1, 0, 3], quaternion: [0, -0.05, 0, 0.999] },
    unitLevel: 'assembly',
  },
  'a-4': {
    projNo: '2570',
    blkNo: '153',
    placement: { position: [0, 0, 2], quaternion: [0, 0, 0, 1] },
    unitLevel: 'assembly',
  },
  'b-1': {
    projNo: '4391',
    blkNo: '154',
    placement: { position: [-1, 0, -2], quaternion: [0, 0.09, 0, 0.996] },
    unitLevel: 'block',
  },
  'b-3': {
    projNo: '4392',
    blkNo: '133',
    placement: { position: [0, 0, 4], quaternion: [0, -0.07, 0, 0.998] },
    unitLevel: 'block',
  },
}

/**
 * 정반 ↔ 야드 지번 매핑 (mock).
 *
 * 조립 화면(정반)과 야드 맵(지번)을 잇는 연결 키다. 실제로는 정반 마스터가 WORK_CNTR
 * 별 LOT 을 들고 있어야 하지만 그 마스터가 아직 없어서, **현업이 지목한 구역**을 따라
 * 옥포 야드의 실제 조립공장 지번(SDE.GIF_LOTSMALL, useType '조립공장')에 앉혔다.
 *
 * 근거는 `temp/공장부지관련참고.png` — 대상 구역 세 곳이 표시돼 있고, 표시된 영역에
 * 걸리는 지번을 뽑으면 다음과 같다:
 *
 *  - 1번 구역 = PBS 1~8 BAY  (PB1B~PB8B, 조립공장)
 *  - 2번 구역 = 3DS 1~3 BAY  (3D1B 소조 / 3D2B 중조 / 3D3B 대조 작업장)
 *  - 3번 구역 = NPS 2·3 BAY  (NP2B·NP3B 대조 작업장)
 *
 * 목업에 공장이 둘뿐이라 앞의 두 구역만 쓴다. PBS 는 베이가 8개인데 목업의 조립
 * 1공장은 4개라 앞의 네 베이(1~4BAY)까지만 대응시켰다 — 정반 이름(1~4번 베이)과
 * BAY 번호가 어긋나지 않게 하려는 것이다. 3번 구역(NPS)과 PBS 5~8BAY 는 대응되는
 * 정반이 아직 없어서 야드 맵에도 뜨지 않는다.
 *
 * 매핑이 바뀌면 이 배열만 고치면 되고, 야드 맵 쪽 코드는 손대지 않는다.
 */
export const mockLocations: Location[] = [
  {
    id: 'a-1',
    factoryId: 'factory-a',
    name: '1번 베이',
    status: 'occupied',
    workCntr: 'J101',
    projNo: '2540',
    blkNo: '281',
    yardLots: ['PB1B01', 'PB1B02', 'PB1B03'],
  },
  {
    id: 'a-2',
    factoryId: 'factory-a',
    name: '2번 베이',
    status: 'occupied',
    workCntr: 'J102',
    projNo: '2543',
    blkNo: '642',
    yardLots: ['PB2B01', 'PB2B02'],
  },
  {
    id: 'a-3',
    factoryId: 'factory-a',
    name: '3번 베이',
    status: 'empty',
    workCntr: 'J103',
    yardLots: ['PB3B01'],
  },
  {
    id: 'a-4',
    factoryId: 'factory-a',
    name: '4번 베이',
    status: 'unknown',
    workCntr: 'J104',
    projNo: '2570',
    blkNo: '153',
    yardLots: ['PB4B01', 'PB4B02', 'PB4B03'],
  },
  {
    id: 'b-1',
    factoryId: 'factory-b',
    name: '1번 베이',
    status: 'occupied',
    workCntr: 'J201',
    projNo: '4391',
    blkNo: '154',
    yardLots: ['3D1B01', '3D1B02', '3D1B03'],
  },
  {
    id: 'b-2',
    factoryId: 'factory-b',
    name: '2번 베이',
    status: 'empty',
    workCntr: 'J202',
    yardLots: ['3D2B01', '3D2B02', '3D2B03'],
  },
  {
    id: 'b-3',
    factoryId: 'factory-b',
    name: '3번 베이',
    status: 'occupied',
    workCntr: 'J203',
    projNo: '4392',
    blkNo: '133',
    yardLots: ['3D3B01', '3D3B02', '3D3B03'],
  },
]

const sensorScanTimes: Record<string, string> = {
  'a-1': '14:32',
  'a-2': '13:58',
  'a-3': '14:50',
  'a-4': '13:05',
  'b-1': '15:02',
  'b-2': '14:58',
  'b-3': '15:10',
}

/** 베이별 센서 수 — 기본 6대(장변 3×2), 주력 베이는 8대(장변 4×2, 사각 최소화) */
const sensorCounts: Record<string, number> = {
  'a-1': 8,
  'b-3': 8,
}
const DEFAULT_SENSOR_COUNT = 6

/** 상태 데모용 예외 — a-2 센서 3은 offline, a-4 센서 1은 error */
const sensorOverrides: Record<string, Partial<LidarSensor>> = {
  'a-2-s3': { status: 'offline', lastScanAt: '11:02' },
  'a-4-s1': { status: 'error', lastScanAt: '12:41' },
}

export const mockLidarSensors: LidarSensor[] = mockLocations.flatMap((location) =>
  Array.from({ length: sensorCounts[location.id] ?? DEFAULT_SENSOR_COUNT }, (_, i): LidarSensor => {
    const id = `${location.id}-s${i + 1}`
    return {
      id,
      locationId: location.id,
      name: `센서 ${i + 1}`,
      status: 'online',
      lastScanAt: sensorScanTimes[location.id],
      ...sensorOverrides[id],
    }
  })
)
