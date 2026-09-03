import {
  EQUIPMENT_PANELS,
  YARD_EQUIPMENT,
  edgePcStatusIn,
  equipmentLinkOf,
  equipmentOfPanel,
  equipmentTypeOf,
  pairIdOf,
  panelStatusIn,
  tiltStatusIn,
  type EdgePcStatus,
  type EquipmentPanel,
  type EquipmentPanelStatus,
  type EquipmentStatusSnapshot,
  type TiltMode,
  type TiltModuleStatus,
  type YardEquipment,
} from '../../../shared/entities/equipment'
import type { LidarSensor, LidarSensorStatus } from '../../../shared/features/bay-viewer/model/lidarSensor'
import { layoutDrawingOf } from '../../../shared/entities/equipment/layoutDrawings'
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

/**
 * 공장 요약 — '현황' 보드 왼쪽 목록의 접힌 줄(설비 **전 종류**).
 *
 * 페어를 이룬 틸팅은 세지 않는다 — 라이다가 그 한 몫을 대표한다(레퍼런스 §3.4).
 * 그리드의 칸 수와 이 대수가 어긋나면 목록이 거짓말을 하게 된다.
 */
export function equipmentSummaryOf(factory: string): { total: number; issues: number } {
  let total = 0
  let issues = 0
  for (const e of YARD_EQUIPMENT) {
    if (e.factory !== factory) continue
    if (e.typeId === 'TILT' && pairIdOf(e)) continue
    total += 1
    if (equipmentLinkOf(e) !== 'online') issues += 1
  }
  return { total, issues }
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


/* ══ 설비 인벤토리 · 상태 (조립 화면 몫의 파생) ══════════════════
 *
 * 라이다만 보던 화면을 260903 교체판 도면의 **전 종류**로 넓힌다. 데이터는 공용 설비
 * 엔티티(실좌표·실대수)이고, 상태는 여전히 mock 이다 — 어느 쪽이 실데이터인지 헷갈리지
 * 않도록 이 파일에서 그 경계를 지킨다.
 */

/** 지도·목록이 세우는 종류 — 조립 권역에 실재하는 것만 (도장 DH/GH 는 도장 화면 몫) */
export const ASSEMBLY_EQUIPMENT_TYPES = ['LIDAR', 'TILT', 'EDGE', 'PNL'] as const
export type AssemblyEquipmentTypeId = (typeof ASSEMBLY_EQUIPMENT_TYPES)[number]

/** 종류 표시색 — 설비 종류 레지스트리의 색을 단일 소스로 쓴다 */
export function equipmentColorOf(typeId: string): string {
  return equipmentTypeOf(typeId)?.color ?? '#7a8794'
}

/** 라이다 표시색 — 기존 호출부(범례·마커) 호환 */
export function lidarColor(): string {
  return equipmentColorOf('LIDAR')
}

/**
 * 설비 한 대의 표시 상태 — 종류별 상태 계약을 마커 한 축(online/offline/error)으로 접는다.
 *
 * 마커는 "지금 눈이 살아 있나"만 말한다. 각도·CPU 같은 종류 고유값은 목록·상세의 몫이다.
 * 규칙 자체는 **shared 의 `equipmentLinkOf` 한 곳**에 있다 — 조립 지도와 의장 목록이 같은
 * 설비에 다른 답을 하지 않도록.
 */
export function equipmentState(e: YardEquipment): LidarSensorStatus {
  return equipmentLinkOf(e)
}

/** 공장 하나의 종류별 대수 — 패널 머리줄의 인벤토리 요약 */
export function equipmentCountsOf(factory: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const e of YARD_EQUIPMENT) {
    if (e.factory !== factory) continue
    counts[e.typeId] = (counts[e.typeId] ?? 0) + 1
  }
  return counts
}

/** 공장 하나의 캐비닛 + 상태 + 소속 설비 — ③설비 단이 그리는 골격 */
export interface PanelWithStatus {
  panel: EquipmentPanel
  status: EquipmentPanelStatus
  members: YardEquipment[]
}

/**
 * 캐비닛 구획에 서는 것은 **Network Panel 뿐**이다.
 *
 * `panelsWithStatus` 는 Edge PC 까지 포함한다(둘 다 소속 설비를 거느리는 캐비닛이라
 * 영향 집계·경고는 둘을 함께 봐야 한다). 하지만 목록에서는 Edge PC 가 제 구획을 따로
 * 갖게 됐으므로, 여기서 걸러 내지 않으면 한 대가 두 구획에 겹쳐 선다.
 */
export function networkPanelsOf(
  factory: string,
  status: EquipmentStatusSnapshot
): PanelWithStatus[] {
  return panelsWithStatus(factory, status).filter((entry) => entry.panel.kind === 'network-panel')
}

/**
 * ⚠️ **스냅샷에 없는 캐비닛은 목록에 서지 않는다.**
 *
 * 상태가 아직 안 온 판을 "정상"으로 그리면 화면이 모르는 것을 아는 척하게 된다. 대신
 * 화면은 스냅샷이 오기 전까지 로딩 자리를 세운다(공용 상태 UI, W7-3b) — 그것이 이 계약을
 * 비동기로 바꾼 이유다.
 */
export function panelsWithStatus(
  factory: string,
  snapshot: EquipmentStatusSnapshot
): PanelWithStatus[] {
  return EQUIPMENT_PANELS.filter((p) => p.factory === factory)
    .flatMap((panel) => {
      const status = panelStatusIn(snapshot, panel.id)
      return status ? [{ panel, status, members: equipmentOfPanel(panel.id) }] : []
    })
    .sort((a, b) => a.panel.id.localeCompare(b.panel.id, undefined, { numeric: true }))
}

/** Edge PC 한 대 + 상태 — 목록이 자원·서비스 지표까지 함께 낸다 */
export interface EdgePcWithStatus {
  equipment: YardEquipment
  status: EdgePcStatus
}

export function edgePcsOf(
  factory: string,
  snapshot: EquipmentStatusSnapshot
): EdgePcWithStatus[] {
  return YARD_EQUIPMENT.filter((e) => e.typeId === 'EDGE' && e.factory === factory)
    .flatMap((equipment) => {
      const status = edgePcStatusIn(snapshot, equipment.id)
      return status ? [{ equipment, status }] : []
    })
    .sort((a, b) => a.equipment.id.localeCompare(b.equipment.id, undefined, { numeric: true }))
}

/** 라이다 한 대의 페어 틸팅 상태 — 마커 상세가 "이 라이다가 지금 어디를 보나"를 말할 때 */
export function tiltOfLidar(
  lidarId: string,
  snapshot: EquipmentStatusSnapshot
): TiltModuleStatus | null {
  const lidar = YARD_EQUIPMENT.find((e) => e.id === lidarId)
  if (!lidar) return null
  const tiltId = pairIdOf(lidar)
  return tiltId ? tiltStatusIn(snapshot, tiltId) : null
}

/**
 * 조립 Factory.id → 그 공장의 설비 배치 도면.
 *
 * 공장 목록(그리드) 화면은 지도 공장 키가 아니라 조립 `Factory.id`(`asm-pbs`)를 들고
 * 있어서, 도면을 찾으려면 한 번 되짚어야 한다. 그 되짚기를 화면마다 쓰지 않도록 여기 둔다.
 */
export function layoutDrawingOfFactoryId(factoryId: string) {
  const name = ASSEMBLY_FACTORIES.find((f) => f.id === factoryId)?.name
  return name ? layoutDrawingOf(name) : null
}

/** 틸팅 한 대 + 상태 — ③설비 단의 틸팅 목록이 각도·모드까지 함께 낸다 */
export interface TiltWithStatus {
  equipment: YardEquipment
  status: TiltModuleStatus
}

/**
 * 공장 하나의 틸팅모듈 + 개별 상태.
 *
 * 페어 라이다와 같은 자리에 서므로 목록에서는 접어 두지만(기본 접힘), 펼치면 한 대씩
 * 모드·현재/목표 각·페어·모터 알람까지 보인다 — 틸팅이 목표에 못 가면 그 라이다는
 * 엉뚱한 곳을 본다. 요약만으로는 그 사실이 드러나지 않는다.
 */
export function tiltsOf(
  factory: string,
  snapshot: EquipmentStatusSnapshot
): TiltWithStatus[] {
  return YARD_EQUIPMENT.filter((e) => e.typeId === 'TILT' && e.factory === factory)
    .flatMap((equipment) => {
      const status = tiltStatusIn(snapshot, equipment.id)
      return status ? [{ equipment, status }] : []
    })
    .sort((a, b) => a.equipment.id.localeCompare(b.equipment.id, undefined, { numeric: true }))
}

/** 틸팅 모드별 대수 — 접힌 줄이 "지금 몇 대가 움직이고 몇 대가 에러인가"를 말한다 */
export function tiltModeCounts(tilts: readonly TiltWithStatus[]): Record<TiltMode, number> {
  const counts: Record<TiltMode, number> = { idle: 0, tilting: 0, error: 0 }
  for (const t of tilts) counts[t.status.mode] += 1
  return counts
}

/* ══ 우측 패널의 구성 (W6-5) ═════════════════════════════════════
 *
 * "어떤 구획이 어떤 순서로 서고, 각 구획에 무엇이 몇 개 들어가는가"를 컴포넌트 밖으로
 * 꺼낸다. 이 레포의 다른 파생 계산과 같은 이유다 — **규칙이 UI 안에 있으면 검증할 수
 * 없다.** 화면을 띄워 눈으로 세는 대신 여기를 테스트한다.
 *
 * 문구는 담지 않는다(키만) — 번역은 컴포넌트가 t() 로 끝낸다.
 */

/** 설비 상태 단의 구획 하나 */
export interface EquipmentSection {
  /** 종류ID — 구획 제목·심볼의 근거 */
  typeId: AssemblyEquipmentTypeId
  /** 이 구획에 든 설비 수 */
  count: number
  /** 접어 두는 구획인가 (틸팅은 라이다와 1:1 이라 펼치면 목록이 두 배가 된다) */
  collapsible: boolean
  /** 베이별로 나뉘는 구획인가 (라이다만 — 정반 단위로 보는 눈이 이미 그렇게 굳었다) */
  groups?: { bay: string; ids: string[] }[]
}

/**
 * 설비 상태 단의 구획 — **관측(라이다 → 틸팅) 먼저, 수집·네트워크(Edge PC → 캐비닛) 나중**.
 * 의장 화면과 같은 순서다: 두 화면을 오갈 때 눈이 다시 적응하지 않아도 된다.
 * 대수가 0인 종류는 구획 자체를 만들지 않는다(빈 제목만 남는 자리를 두지 않는다).
 */
export function equipmentSectionsOf(factory: string): EquipmentSection[] {
  const counts = equipmentCountsOf(factory)
  const sections: EquipmentSection[] = []

  const bays = lidarsByBay(factory)
  if (bays.size > 0) {
    sections.push({
      typeId: 'LIDAR',
      count: counts.LIDAR ?? 0,
      collapsible: false,
      groups: [...bays.entries()].map(([bay, list]) => ({ bay, ids: list.map((e) => e.id) })),
    })
  }
  if ((counts.TILT ?? 0) > 0)
    sections.push({ typeId: 'TILT', count: counts.TILT, collapsible: true })
  if ((counts.EDGE ?? 0) > 0)
    sections.push({ typeId: 'EDGE', count: counts.EDGE, collapsible: false })
  const panelCount = EQUIPMENT_PANELS.filter(
    (p) => p.factory === factory && p.kind === 'network-panel'
  ).length
  if (panelCount > 0) sections.push({ typeId: 'PNL', count: panelCount, collapsible: false })

  return sections
}

/** 수집 현황 한 줄 — 라벨은 번역 키, 값은 이미 센 결과 */
export interface CollectionRowSpec {
  labelKey: string
  value: string
}

/**
 * ②수집 현황의 줄과 나가는 문.
 *
 * 값 계산과 라우팅 대상을 한 곳에 둔다 — 화면이 `/indoorshop/zones/assembly/${id}` 를 손으로 짜면
 * 공장 id 가 없는 경우(CAS/PAS)에 안 열리는 문이 생긴다.
 */
export function collectionRowsOf(overview: {
  bays: readonly { projNo?: string }[]
  todayCount: number
  lastScanAt?: string
}): CollectionRowSpec[] {
  const detected = overview.bays.filter((b) => b.projNo != null).length
  return [
    { labelKey: 'assembly.mapEntry.collection.detected', value: String(detected) },
    { labelKey: 'assembly.mapEntry.collection.judgedToday', value: String(overview.todayCount) },
    {
      labelKey: 'assembly.mapEntry.collection.lastScan',
      /* 실측 정반은 ISO 시각을 준다 — 목업(HH:MM)과 같은 낱말로 줄인다 */
      value: overview.lastScanAt
        ? overview.lastScanAt.includes('T')
          ? overview.lastScanAt.slice(11, 16)
          : overview.lastScanAt
        : '—',
    },
  ]
}

/** 수집 현황에서 공장 현황으로 나가는 경로 — 짝이 없는 공장(CAS/PAS)은 null */
export function factoryStatusHref(mapKey: string): string | null {
  const id = assemblyFactoryIdOf(mapKey)
  return id ? `/indoorshop/zones/assembly/${id}` : null
}
