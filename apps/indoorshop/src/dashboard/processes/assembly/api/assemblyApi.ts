import type { Factory } from '../../../shared/entities/factory/model/types'
import type { Location } from '../../../shared/entities/location/model/types'
import type { LidarSensor } from '../../../shared/features/bay-viewer/model/lidarSensor'
import type { LidarBlockInfo } from '../../../shared/features/bay-viewer/model/lidarBlock'
import { loadBlockManifest, loadBlockModel } from '../../../shared/features/bay-viewer/api/loadBlockModel'
import {
  buildBayDetections,
  type BayModelInfo,
} from '../../../shared/features/bay-viewer/lib/mockDetections'
import type {
  FactoryBaySummary,
  FactoryOverview,
} from '../../../shared/entities/factory/model/overview'
import {
  mockFactories,
  mockLocations,
  mockLidarSensors,
  bayBlockAssignments,
} from './mockAssemblyData'
import { ASSEMBLY_FACTORIES } from './assemblyFactoryFixture'
import { shiftDate, todayString } from '../../../shared/lib/timeAxis'
import { buildMockFactoryLayout, buildYardFactoryLayout, type FactoryLayout } from '../../../shared/features/bay-viewer/lib/bayLayout'
import {
  fetchRealLocations,
  isRealLocation,
  fetchRealLidarSensors,
  fetchRealDetectedBlocks,
} from './realScanData'

/**
 * 조립 모니터링 데이터 API.
 *
 * 백엔드 연동(OT-Server ↔ ISL Server 결과 전달 프로토콜)이 미확정이라
 * 현재 구현은 mock + 실제 CAD(FBX 전처리) 기반 데이터를 반환한다.
 * 실연동 시 이 파일의 함수 구현만 실제 HTTP 호출로 교체하면 되고,
 * 호출부(컴포넌트)는 수정이 필요 없다.
 */

/** 실제 네트워크 호출처럼 동작하도록 주는 인위적 지연 */
const MOCK_LATENCY_MS = 150

function withLatency<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS))
}

export function fetchFactories(): Promise<Factory[]> {
  return withLatency([...mockFactories])
}

export async function fetchLocations(factoryId?: string): Promise<Location[]> {
  /* 실측 정반(PBS 5BAY)은 목업 목록의 **같은 자리에 교체**한다 — id 규약이 같아
   * (`asm-pbs-b5`) 순서가 그대로 유지되고, 실측이라고 목록 끝으로 밀리지 않는다. */
  const realById = new Map((await fetchRealLocations()).map((location) => [location.id, location]))
  const all = mockLocations.map((location) => realById.get(location.id) ?? location)
  return withLatency(factoryId ? all.filter((loc) => loc.factoryId === factoryId) : all)
}

/**
 * 정반의 LiDAR.
 *
 * 목업 정반은 **이관된 설비 엔티티**가 원천이다(`mockLidarSensors` — 이름이 곧 설비ID).
 * 실측 정반(PBS 5BAY)만 예외로 실측 자산의 센서를 낸다 — 그 이름은 지어낸 것이 아니라
 * 스캐너의 실제 주소(IP)다. 자산을 못 읽는 환경에서는 같은 베이의 설비 목록으로 물러난다:
 * 목록이 통째로 비는 것보다 낫고, 물러난 값도 지어낸 이름이 아니다.
 */
export async function fetchLidarSensors(locationId: string): Promise<LidarSensor[]> {
  const fromEquipment = () =>
    withLatency(mockLidarSensors.filter((sensor) => sensor.locationId === locationId))
  if (isRealLocation(locationId)) {
    try {
      return await fetchRealLidarSensors(locationId)
    } catch {
      return fromEquipment()
    }
  }
  return fromEquipment()
}

/**
 * 공장 배치(레이아웃) — 베이 경계·통로 관계의 단일 출처 (PRD FR-3).
 * 현장 shop/bay 좌표가 확정되기 전이므로 목업 배치(`source: 'mock'`)를 내려준다.
 * 실측 좌표 확정 시 이 함수만 실제 조회로 바꾸면 뷰어는 수정이 필요 없다.
 */
export async function fetchFactoryLayout(factoryId: string): Promise<FactoryLayout> {
  const locations = await fetchLocations(factoryId)
  /* 실형상(야드 fixture 파생)이 1순위 — 베이 하나라도 fixture 에 없으면 통째로 목업
   * 폴백한다(반쪽 실형상은 반쪽 거짓말). 실연동 시 이 자리가 'surveyed' 조회로 바뀐다.
   * 공장명은 지번 fixture 의 연결 키다 — 빌더는 공정을 모르므로 여기서 찾아 넘긴다. */
  const factoryName = ASSEMBLY_FACTORIES.find((f) => f.id === factoryId)?.name ?? ''
  const yard = await buildYardFactoryLayout(factoryId, factoryName, locations).catch(() => null)
  return yard ?? buildMockFactoryLayout(factoryId, locations)
}

/* mock detection 생성(신뢰도·이력·분리 배치)은 조립 1/2공장 mock 문법의 단일 소스로
 * shared bay-viewer(`lib/mockDetections`)에 승격되었다 — 시드가 같아 값은 그대로다. */
export type { BayModelInfo } from '../../../shared/features/bay-viewer/lib/mockDetections'

export async function fetchBayModel(locationId: string): Promise<BayModelInfo | null> {
  const assignment = bayBlockAssignments[locationId]
  if (!assignment) return withLatency(null)
  const model = await loadBlockModel(assignment.projNo, assignment.blkNo)
  return { model, placement: assignment.placement }
}

/** 문자열 기반 결정적 의사난수 (mock 집계가 렌더링마다 흔들리지 않도록) */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

export async function fetchDetectedBlocks(locationId: string): Promise<LidarBlockInfo[]> {
  if (isRealLocation(locationId)) return fetchRealDetectedBlocks(locationId)
  const assignment = bayBlockAssignments[locationId]
  if (!assignment) return withLatency([])

  const bayModel = (await fetchBayModel(locationId)) as BayModelInfo
  return buildBayDetections(locationId, bayModel, assignment.unitLevel)
}

// ── 일일 소조 생산 카운트 (mock — 실연동 시 인식 파이프라인의 완료 판정 집계로 대체) ──

/** 완료 판정된 조립품 1건의 내역 */
export interface CompletedItem {
  /** 계층 ID (예: '627-FR755') */
  id: string
  wstgCode: string
  /** 완료 판정 시각 */
  time: string
}

export interface BayDailyProduction {
  locationId: string
  name: string
  workCntr: string
  /** 과거 → 오늘 순 최근 7일 */
  daily: { label: string; count: number }[]
  todayCount: number
  weekTotal: number
  /** 오늘 완료된 조립품 내역 — todayCount와 일치 */
  todayItems: CompletedItem[]
}

const COMPLETION_TIMES = ['09:12', '10:45', '13:28', '15:05', '16:40']

/**
 * **기준일에** 완료 판정된 조립품 내역 — 해당 베이 블록의 실제 조립체에서 추출.
 *
 * 매니페스트만 읽는다(geometry 불필요). 생산 현황·공장 목록이 같은 함수를 쓰므로
 * 두 화면의 "그날 n건"이 어긋나지 않는다.
 *
 * 기준일이 시드에 들어간다 — 되감으면 그날의 건수가 나와야지, 어제를 보는데 오늘 수가
 * 그대로 서 있으면 화면이 거짓말이 된다(연계 매트릭스 §2.3).
 */
async function fetchDayCompletions(
  locationId: string,
  baseDate: string
): Promise<CompletedItem[]> {
  const assignment = bayBlockAssignments[locationId]
  if (!assignment) return []

  const manifest = await loadBlockManifest(assignment.projNo, assignment.blkNo)
  const eligible = manifest.assemblies.filter(
    (a) => a.id !== 'MISC' && a.vertexCount >= 1500 && a.partCount >= 4
  )
  if (eligible.length === 0) return []

  const count = Math.min(eligible.length, 1 + (hashOf(`${locationId}-${baseDate}-prod`) % 4))
  const start = hashOf(`${locationId}-pick`) % eligible.length
  return Array.from({ length: count }, (_, i) => {
    const assembly = eligible[(start + i) % eligible.length]
    return {
      id: `${manifest.blkNo}-${assembly.id}`,
      wstgCode: assembly.wstgCode,
      time: COMPLETION_TIMES[i % COMPLETION_TIMES.length],
    }
  })
}

/**
 * 공장 내 베이별 일일 소조립품 완료 수 + 내역 (기준일까지 최근 7일).
 *
 * **기준일을 인자로 받는다.** 예전에는 여기서 `new Date()` 를 직접 불러서, 통합실적이
 * `?date=` 로 사흘 전을 말하는 동안 이 화면만 오늘을 말했다(연계 매트릭스 §2.3 · 3위).
 * 기본값은 오늘이라 기준일을 넘기지 않는 호출부는 지금까지와 똑같이 돈다.
 */
export async function fetchDailyProduction(
  factoryId: string,
  baseDate: string = todayString()
): Promise<BayDailyProduction[]> {
  const locations = await fetchLocations(factoryId)

  return Promise.all(
    locations.map(async (location) => {
      const assignment = bayBlockAssignments[location.id]
      const todayItems = await fetchDayCompletions(location.id, baseDate)

      const daily = Array.from({ length: 7 }, (_, i) => {
        /* 기준일이 창의 끝 — 그 앞 6일이 왼쪽에 선다 (통합실적의 조회 창과 같은 문법) */
        const date = shiftDate(baseDate, -(6 - i))
        const [, month, day] = date.split('-')
        const label = `${Number(month)}/${Number(day)}`
        const isToday = i === 6
        const count = isToday
          ? todayItems.length
          : assignment
            ? 1 + (hashOf(`${location.id}-${date}-prod`) % 6)
            : 0
        return { label, count }
      })
      const weekTotal = daily.reduce((s, d) => s + d.count, 0)

      return {
        locationId: location.id,
        name: location.name,
        workCntr: location.workCntr,
        daily,
        todayCount: todayItems.length,
        weekTotal,
        todayItems,
      }
    })
  )
}

// ── 공장 개요 (목록 화면용 집계) ──

/** 'HH:MM' 문자열 비교 — 같은 날 안의 시각만 다루므로 사전순이 곧 시간순 */
function laterTime(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

function summarizeUnitLevel(bays: FactoryBaySummary[]): FactoryOverview['unitLevel'] {
  const levels = new Set(bays.map((bay) => bay.unitLevel).filter(Boolean))
  if (levels.size === 0) return 'none'
  if (levels.size > 1) return 'mixed'
  return [...levels][0] as 'assembly' | 'block'
}

/**
 * 공장 목록 화면이 쓰는 집계.
 *
 * 카드마다 따로 fetch 하면 공장 수만큼 요청이 늘고 카드가 제각기 늦게 채워진다 —
 * 목록은 한 번에 서야 하므로 여기서 베이·센서·완료 판정을 미리 합쳐 내려준다.
 */
export async function fetchFactoryOverviews(
  baseDate: string = todayString()
): Promise<FactoryOverview[]> {
  const [factories, locations] = await Promise.all([fetchFactories(), fetchLocations()])

  return Promise.all(
    factories.map(async (factory): Promise<FactoryOverview> => {
      const factoryLocations = locations.filter((location) => location.factoryId === factory.id)

      const bays = await Promise.all(
        factoryLocations.map(async (location): Promise<FactoryBaySummary> => {
          const [sensors, todayItems] = await Promise.all([
            fetchLidarSensors(location.id),
            // 목록 화면은 완료 건수 하나 때문에 통째로 무너지면 안 된다 —
            // 매니페스트를 못 읽으면 그 정반만 0건으로 두고 나머지를 세운다
            fetchDayCompletions(location.id, baseDate).catch(() => []),
          ])
          return {
            locationId: location.id,
            name: location.name,
            workCntr: location.workCntr,
            status: location.status,
            projNo: location.projNo,
            blkNo: location.blkNo,
            unitLevel: bayBlockAssignments[location.id]?.unitLevel,
            yardLots: location.yardLots,
            sensorTotal: sensors.length,
            sensorOnline: sensors.filter((sensor) => sensor.status === 'online').length,
            lastScanAt: sensors.reduce<string | undefined>(
              (latest, sensor) => laterTime(latest, sensor.lastScanAt),
              undefined
            ),
            todayCount: todayItems.length,
          }
        })
      )

      const sensorTotal = bays.reduce((sum, bay) => sum + bay.sensorTotal, 0)
      const sensorOnline = bays.reduce((sum, bay) => sum + bay.sensorOnline, 0)

      return {
        factory,
        bays,
        occupiedCount: bays.filter((bay) => bay.status === 'occupied').length,
        emptyCount: bays.filter((bay) => bay.status === 'empty').length,
        unknownCount: bays.filter((bay) => bay.status === 'unknown').length,
        sensorTotal,
        sensorOnline,
        sensorFault: sensorTotal - sensorOnline,
        lastScanAt: bays.reduce<string | undefined>(
          (latest, bay) => laterTime(latest, bay.lastScanAt),
          undefined
        ),
        todayCount: bays.reduce((sum, bay) => sum + bay.todayCount, 0),
        unitLevel: summarizeUnitLevel(bays),
      }
    })
  )
}
