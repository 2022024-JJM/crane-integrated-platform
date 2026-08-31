import type { Factory } from '../../../shared/entities/factory/model/types'
import type { Location } from '../../../shared/entities/location/model/types'
import type { LidarSensor } from '../model/lidarSensor'
import type {
  AssemblyPlanInfo,
  LidarBlockInfo,
  LidarBlockTransform,
  LidarHistoryEvent,
  SubAssemblyStatus,
} from '../model/lidarBlock'
import type { BlockAssemblyEntry, LoadedBlockModel } from '../model/blockModel'
import { loadBlockManifest, loadBlockModel } from './loadBlockModel'
import { restExtents } from '../model/blockModel'
import type {
  FactoryBaySummary,
  FactoryOverview,
} from '../../../shared/entities/factory/model/overview'
import { BAY_WIDTH } from '../lib/bayConfig'
import {
  mockFactories,
  mockLocations,
  mockLidarSensors,
  bayBlockAssignments,
} from './mockAssemblyData'
import { ASSEMBLY_FACTORIES } from './assemblyFactoryFixture'
import { buildMockFactoryLayout, type FactoryLayout } from './bayLayout'
import {
  REAL_FACTORY,
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
  /* GBS(실측)는 fixture 의 원래 GBS 자리에 끼운다 — 실측이라고 목록 끝으로 밀리면
   * 공장 순서가 지도·탭과 어긋난다. mockFactories 에는 GBS 가 없다(mockAssemblyData). */
  const factories = [...mockFactories]
  const gbsIndex = ASSEMBLY_FACTORIES.findIndex((factory) => factory.id === REAL_FACTORY.id)
  factories.splice(gbsIndex < 0 ? factories.length : gbsIndex, 0, REAL_FACTORY)
  return withLatency(factories)
}

export async function fetchLocations(factoryId?: string): Promise<Location[]> {
  const all = [...mockLocations, ...(await fetchRealLocations())]
  return withLatency(factoryId ? all.filter((loc) => loc.factoryId === factoryId) : all)
}

export function fetchLidarSensors(locationId: string): Promise<LidarSensor[]> {
  if (isRealLocation(locationId)) return fetchRealLidarSensors(locationId)
  return withLatency(mockLidarSensors.filter((sensor) => sensor.locationId === locationId))
}

/**
 * 공장 배치(레이아웃) — 베이 경계·통로 관계의 단일 출처 (PRD FR-3).
 * 현장 shop/bay 좌표가 확정되기 전이므로 목업 배치(`source: 'mock'`)를 내려준다.
 * 실측 좌표 확정 시 이 함수만 실제 조회로 바꾸면 뷰어는 수정이 필요 없다.
 */
export async function fetchFactoryLayout(factoryId: string): Promise<FactoryLayout> {
  const locations = await fetchLocations(factoryId)
  return buildMockFactoryLayout(factoryId, locations)
}

/** 베이에 배정된 블록의 CAD 모델 + 정반 내 배치 transform */
export interface BayModelInfo {
  model: LoadedBlockModel
  placement: LidarBlockTransform
}

export async function fetchBayModel(locationId: string): Promise<BayModelInfo | null> {
  const assignment = bayBlockAssignments[locationId]
  if (!assignment) return withLatency(null)
  const model = await loadBlockModel(assignment.projNo, assignment.blkNo)
  return { model, placement: assignment.placement }
}

// ── detection 파생 헬퍼 (mock — 실연동 시 인식 파이프라인 결과로 대체) ──

/** 문자열 기반 결정적 의사난수 (mock 신뢰도 등 렌더링마다 값이 흔들리지 않도록) */
function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

function mockConfidence(id: string): number {
  return 0.78 + (hashOf(id) % 18) / 100 // 0.78 ~ 0.95
}

function mockPlan(id: string): AssemblyPlanInfo {
  const day = 10 + (hashOf(id) % 14)
  return {
    planStartDate: `07/${String(day).padStart(2, '0')}`,
    planEndDate: `08/${String((day % 12) + 1).padStart(2, '0')}`,
  }
}

/** detection의 현재 진척률(%) — mock 결정적 값 (45~94) */
function mockProgress(id: string): number {
  return 45 + (hashOf(`${id}-progress`) % 50)
}

/** 라이다 관측 기반 진척률이 붙은 인식 히스토리 (mock — 스캔 갱신마다 진척률 상승) */
function mockHistory(id: string, arrivalEvent: string): LidarHistoryEvent[] {
  const latest = mockProgress(id)
  return [
    { timestamp: '14:32', event: '스캔 갱신', progress: latest },
    { timestamp: '09:10', event: '스캔 갱신', progress: Math.max(5, latest - 16) },
    { timestamp: '07/31', event: arrivalEvent, progress: Math.max(3, latest - 33) },
  ]
}

/**
 * 하위 구성품 작업 상태 (mock) — 상위 진척률과 정합되게 생성:
 * 진척률이 높을수록 완료된 하위 구성품 비율이 높고, 경계 근처는 작업중(진척률 보유).
 */
function mockSubAssemblies(
  parentId: string,
  children: { id: string; wstgCode: string; partCount: number }[],
  parentProgress: number
): SubAssemblyStatus[] {
  const n = children.length
  return children.map((child, index) => {
    const slot = ((index + 0.5) / n) * 100
    const jitter = (hashOf(parentId + child.id) % 21) - 10
    const boundary = slot + jitter
    if (parentProgress >= boundary + 12) return { ...child, workStatus: 'completed' }
    if (parentProgress <= boundary - 12) return { ...child, workStatus: 'not_started' }
    const progress = Math.min(95, Math.max(5, Math.round(50 + (parentProgress - boundary) * 3)))
    return { ...child, workStatus: 'in_progress', progress }
  })
}

/** 조립체 id 기반의 미세한 yaw 회전 (분리 배치가 너무 정렬돼 보이지 않도록) */
function yawQuaternion(id: string): [number, number, number, number] {
  const angle = ((hashOf(id) % 9) - 4) * 0.025
  return [0, +Math.sin(angle / 2).toFixed(4), 0, +Math.cos(angle / 2).toFixed(4)]
}

/**
 * 중조립품 분리 배치 — 조립 1공장의 중조들은 아직 블록으로 조립되기 전이므로
 * CAD 원위치가 아니라 정반 위에 각각 떨어뜨려 놓는다 (면적 내림차순 shelf packing).
 * 각 조립체 geometry는 viewer에서 자기 bbox 바닥 중심 기준으로 재정렬된 뒤 이 위치에 놓인다.
 */
function layoutAssemblies(assemblies: BlockAssemblyEntry[]): Map<string, LidarBlockTransform> {
  const GAP = 2.5
  const usableWidth = BAY_WIDTH - 4

  // 안정 안착 자세(눕힌 상태)의 footprint 기준으로 배치
  const items = assemblies
    .map((a) => {
      const [w, , d] = restExtents(a)
      return { a, w, d }
    })
    .sort((p, q) => q.w * q.d - p.w * p.d)

  const raw = new Map<string, { x: number; z: number }>()
  let zCursor = 0
  let shelf: typeof items = []
  let shelfWidth = 0

  const flushShelf = () => {
    if (shelf.length === 0) return
    const totalWidth = shelfWidth - GAP
    const shelfDepth = Math.max(...shelf.map((i) => i.d))
    let x = -totalWidth / 2
    for (const item of shelf) {
      raw.set(item.a.id, { x: x + item.w / 2, z: zCursor + shelfDepth / 2 })
      x += item.w + GAP
    }
    zCursor += shelfDepth + GAP
    shelf = []
    shelfWidth = 0
  }

  for (const item of items) {
    if (shelf.length > 0 && shelfWidth + item.w > usableWidth) flushShelf()
    shelf.push(item)
    shelfWidth += item.w + GAP
  }
  flushShelf()

  // 전체 배치를 정반 중앙(z=0) 기준으로 정렬 — 센서 FOV 커버리지가 가장 좋은 영역에 놓이도록
  const totalDepth = zCursor - GAP
  const zOffset = -totalDepth / 2
  const placements = new Map<string, LidarBlockTransform>()
  for (const [id, pos] of raw) {
    placements.set(id, {
      position: [+pos.x.toFixed(2), 0, +(pos.z + zOffset).toFixed(2)],
      quaternion: yawQuaternion(id),
    })
  }
  return placements
}

function assemblyDimensions(assembly: BlockAssemblyEntry) {
  // 안정 안착 자세(눕힌 상태) 기준 치수
  const [length, height, width] = restExtents(assembly)
  return {
    length: +length.toFixed(1),
    width: +width.toFixed(1),
    height: +height.toFixed(1),
  }
}

export async function fetchDetectedBlocks(locationId: string): Promise<LidarBlockInfo[]> {
  if (isRealLocation(locationId)) return fetchRealDetectedBlocks(locationId)
  const assignment = bayBlockAssignments[locationId]
  if (!assignment) return withLatency([])

  const { model, placement } = (await fetchBayModel(locationId)) as BayModelInfo
  const { manifest } = model
  // MISC(블록 직부재)와 소형 부속품(브라켓급 — PCD가 유의미하게 잡히지 않음)은 인식 단위에서 제외
  const assemblies = manifest.assemblies.filter(
    (a) => a.id !== 'MISC' && a.vertexCount >= 1500 && a.partCount >= 4
  )

  if (assignment.unitLevel === 'block') {
    // 조립 2공장: 대조립(블록) 단위 인식 — 블록 전체가 detection 1건
    const detection: LidarBlockInfo = {
      id: `${locationId}-${manifest.blkNo}`,
      locationId,
      projNo: manifest.projNo,
      blkNo: manifest.blkNo,
      assySerNo: null,
      blockName: `대조립 블록 ${manifest.blkNo}`,
      wstgCode: manifest.wstgCode,
      cadRegistered: true,
      plan: mockPlan(manifest.blkNo),
      confidence: mockConfidence(`${manifest.projNo}-${manifest.blkNo}`),
      dimensions: (() => {
        // 안정 안착 자세 기준 치수 (블록 레벨 rest pose)
        const [length, height, width] = restExtents(manifest)
        return {
          length: +length.toFixed(1),
          width: +width.toFixed(1),
          height: +height.toFixed(1),
        }
      })(),
      transform: placement,
      history: mockHistory(`${manifest.projNo}-${manifest.blkNo}`, '블록 반입 감지'),
      modelAssemblyIds: manifest.assemblies.map((a) => a.id), // MISC 포함 전체 형상
      subAssemblies: mockSubAssemblies(
        `${manifest.projNo}-${manifest.blkNo}`,
        assemblies.map((a) => ({ id: a.id, wstgCode: a.wstgCode, partCount: a.partCount })),
        mockProgress(`${manifest.projNo}-${manifest.blkNo}`)
      ),
    }
    return [detection]
  }

  // 조립 1공장: 중조립품 단위 인식 — 조립체마다 detection, 정반 위에 분리 배치
  const placements = layoutAssemblies(assemblies)
  return assemblies.map((assembly, index): LidarBlockInfo => {
    const detectionId = `${locationId}-${assembly.id}`
    return {
      id: detectionId,
      locationId,
      projNo: manifest.projNo,
      blkNo: manifest.blkNo,
      assySerNo: assembly.id,
      blockName: `중조립품 ${assembly.id}`,
      wstgCode: assembly.wstgCode,
      // 데모: 두 번째 조립체는 PCD↔CAD registering 실패 상태 (도면 미매핑 PCD 케이스)
      cadRegistered: index !== 1,
      plan: mockPlan(detectionId),
      confidence: mockConfidence(detectionId),
      dimensions: assemblyDimensions(assembly),
      transform: placements.get(assembly.id)!,
      // 정합 실패 시 진척률 추정 불가 — 이벤트만 남긴다
      history:
        index !== 1
          ? mockHistory(detectionId, '정반 안착 감지')
          : mockHistory(detectionId, '정반 안착 감지').map(({ timestamp, event }) => ({
              timestamp,
              event,
            })),
      modelAssemblyIds: [assembly.id],
      subAssemblies: mockSubAssemblies(
        detectionId,
        assembly.children.map((c) => ({ id: c.id, wstgCode: c.wstgCode, partCount: c.partCount })),
        mockProgress(detectionId)
      ),
    }
  })
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
 * 오늘 완료 판정된 조립품 내역 — 해당 베이 블록의 실제 조립체에서 추출.
 *
 * 매니페스트만 읽는다(geometry 불필요). 생산 현황·공장 목록이 같은 함수를 쓰므로
 * 두 화면의 "오늘 n건"이 어긋나지 않는다.
 */
async function fetchTodayCompletions(locationId: string): Promise<CompletedItem[]> {
  const assignment = bayBlockAssignments[locationId]
  if (!assignment) return []

  const manifest = await loadBlockManifest(assignment.projNo, assignment.blkNo)
  const eligible = manifest.assemblies.filter(
    (a) => a.id !== 'MISC' && a.vertexCount >= 1500 && a.partCount >= 4
  )
  if (eligible.length === 0) return []

  const count = Math.min(eligible.length, 1 + (hashOf(`${locationId}-today-prod`) % 4))
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

/** 공장 내 베이별 일일 소조립품 완료 수 + 내역 (최근 7일) */
export async function fetchDailyProduction(factoryId: string): Promise<BayDailyProduction[]> {
  const locations = await fetchLocations(factoryId)
  const today = new Date()

  return Promise.all(
    locations.map(async (location) => {
      const assignment = bayBlockAssignments[location.id]
      const todayItems = await fetchTodayCompletions(location.id)

      const daily = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (6 - i))
        const label = `${d.getMonth() + 1}/${d.getDate()}`
        const isToday = i === 6
        const count = isToday
          ? todayItems.length
          : assignment
            ? 1 + (hashOf(`${location.id}-${label}-prod`) % 6)
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
export async function fetchFactoryOverviews(): Promise<FactoryOverview[]> {
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
            fetchTodayCompletions(location.id).catch(() => []),
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
