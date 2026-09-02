import { YARD_EQUIPMENT, equipmentTypeOf, type YardEquipment } from '../../../shared/entities/equipment'
import type { MapEntryMarker } from '../../../shared/features/process-map-entry'
import type { LidarSensor, LidarSensorStatus } from '../../../shared/features/bay-viewer/model/lidarSensor'
import { ASSEMBLY_FACTORIES } from '../api/assemblyFactoryFixture'
import { ASSEMBLY_FACTORY_ID_BY_MAP_KEY } from '../api/mapDrilldown'
import { REAL_LOCATION_ID } from '../api/realScanData'

/*
 * 조립 맵 진입 화면의 순수 계산 — 어떤 공장을 주인공으로 세우고, 설비 엔티티의 LiDAR
 * 실좌표를 어떻게 마커·센서 목록으로 바꾸는가. 화면(React)에서 떼어 둔 것은 이 레포의
 * 다른 파생 계산과 같은 이유다: 규칙이 UI 안에 있으면 검증할 수 없다.
 */

/**
 * CAS·PAS — 가공 공정 소속의 판넬/곡블록 조립 라인.
 *
 * 조립 화면의 주인공에 **편입**하되(TO-BE v2: 조립 담당이 한 화면에서 같이 본다),
 * `accentOf` 를 주지 않아 지도에서는 제 공정색(가공 초록)으로 선다 — 조립 파랑으로
 * 칠하면 소속을 속이는 그림이 된다. 실적 수집은 아직 없어(②수집 현황은 안내 문구)
 * 모드B 라인 카운팅 연동이 확정되면 그 자리가 채워진다.
 */
export const FABRICATION_LINE_FACTORIES = ['CAS', 'PAS'] as const

/** 맵 진입의 주인공 공장 순서 — 조립 7공장(fixture 순서) 뒤에 CAS·PAS */
export function assemblyMapFactoryNames(): string[] {
  return [...ASSEMBLY_FACTORIES.map((f) => f.name), ...FABRICATION_LINE_FACTORIES]
}

export function isFabricationLine(factory: string): boolean {
  return (FABRICATION_LINE_FACTORIES as readonly string[]).includes(factory)
}

/** 지도 공장 키 → 조립 Factory.id — CAS/PAS 는 조립 API 에 없으므로 null */
export function assemblyFactoryIdOf(mapKey: string): string | null {
  return ASSEMBLY_FACTORY_ID_BY_MAP_KEY[mapKey] ?? null
}

/** `YardParcelBay.id`(`{공장}#{베이}`) → 조립 location id (`asm-pbs-b5`) — 짝이 없으면 null */
export function assemblyLocationIdOfBay(bayId: string): string | null {
  const [factory, bayNo] = bayId.split('#')
  const factoryId = factory ? assemblyFactoryIdOf(factory) : null
  if (!factoryId || !bayNo) return null
  return `${factoryId}-b${bayNo}`
}

export function isRealScanBay(bayId: string): boolean {
  return assemblyLocationIdOfBay(bayId) === REAL_LOCATION_ID
}

/** 문자열 기반 결정적 의사난수 — assemblyApi mock 과 같은 방식(렌더마다 흔들리지 않게) */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * 설비 한 대의 mock 상태 — 실좌표(설비 엔티티)는 실데이터이고 **상태만** 목업이다.
 * 기존 센서 mock 과 같은 결정론 해시라 화면을 다시 열어도 같은 그림이 나온다.
 * 분포는 대부분 온라인, 드물게 점검(오프라인)·오류.
 */
export function mockLidarStatus(id: string): LidarSensorStatus {
  const h = hashOf(`${id}-status`)
  if (h % 29 === 0) return 'error'
  if (h % 13 === 0) return 'offline'
  return 'online'
}

/** 스캔 시각 — 결정론적 (13:00~15:59, mockAssemblyData.scanTimeOf 와 같은 규칙) */
export function mockScanTime(id: string): string {
  const h = 13 + (hashOf(`${id}-scan-h`) % 3)
  const m = hashOf(`${id}-scan-m`) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 맵 마커로 세울 LiDAR 한 대 — 프레임 마커 계약 + 상태 */
export interface AssemblyLidarMarker extends MapEntryMarker {
  bay: string
  status: LidarSensorStatus
}

/** 라이다 표시색 — 설비 종류 레지스트리의 색을 단일 소스로 쓴다 */
export function lidarColor(): string {
  return equipmentTypeOf('LIDAR')?.color ?? '#6a4fd0'
}

/** 주인공 공장들의 LiDAR 실좌표 마커 (설비 엔티티 기준 — 대수도 좌표도 실데이터) */
export function assemblyLidarMarkers(factoryNames: readonly string[]): AssemblyLidarMarker[] {
  const names = new Set(factoryNames)
  return YARD_EQUIPMENT.filter((e) => e.typeId === 'LIDAR' && names.has(e.factory)).map(
    (e): AssemblyLidarMarker => ({
      id: e.id,
      factory: e.factory,
      bay: e.bay,
      lat: e.lat,
      lon: e.lon,
      status: mockLidarStatus(e.id),
      title: `${e.id} · ${e.factory} ${e.bay}BAY`,
      ariaLabel: `${e.id} LiDAR`,
    })
  )
}

/** 공장 하나의 LiDAR 를 베이별로 묶는다 — 우측 패널 ①센서 상태의 골격 */
export function lidarsByBay(factory: string): Map<string, YardEquipment[]> {
  const map = new Map<string, YardEquipment[]>()
  for (const e of YARD_EQUIPMENT) {
    if (e.typeId !== 'LIDAR' || e.factory !== factory) continue
    const key = e.bay || '-'
    const list = map.get(key)
    if (list) list.push(e)
    else map.set(key, [e])
  }
  for (const list of map.values()) list.sort((a, b) => a.id.localeCompare(b.id))
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })))
}

/** 설비 → 기존 센서 목록 컴포넌트(LidarSensorStatusList)의 계약으로 변환 */
export function toLidarSensor(e: YardEquipment): LidarSensor {
  return {
    id: e.id,
    locationId: `${e.factory}#${e.bay}`,
    name: e.id,
    status: mockLidarStatus(e.id),
    lastScanAt: mockScanTime(e.id),
  }
}

/** 공장 요약 — 카드 접힌 줄에 쓰는 대수·이상 집계 (실좌표 기반 대수) */
export function lidarSummaryOf(factory: string): { total: number; issues: number } {
  let total = 0
  let issues = 0
  for (const e of YARD_EQUIPMENT) {
    if (e.typeId !== 'LIDAR' || e.factory !== factory) continue
    total += 1
    if (mockLidarStatus(e.id) !== 'online') issues += 1
  }
  return { total, issues }
}
