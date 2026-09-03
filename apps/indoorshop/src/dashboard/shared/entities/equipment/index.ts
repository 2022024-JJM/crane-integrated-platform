/**
 * 야드 설비 — 단일 소스 진입점.
 *
 * 설비를 그리는 화면(지금은 도장 SCADA, 다음은 조립 LiDAR 배치)은 **이 파일만** import
 * 한다. 503대 정도는 가벼워 정적 import 로 두고 모듈 로드 때 한 번만 디코딩한다 —
 * yard-parcels 처럼 dynamic import 로 미루면 소비자(도장 repository)가 비동기가 되어
 * 화면 계층까지 파급되는데, 그 무게를 치를 크기가 아니다. 목록·맵이 같은 배열을
 * 참조하므로 필터 결과를 참조 비교로 가릴 수 있다.
 *
 * 실연동(설비 마스터를 API 로 받는) 시 이 파일의 데이터 소스만 교체하면 되고,
 * 소비자는 손대지 않는다.
 *
 * ⚠️ LiDAR(LD-*)·틸팅(PT-*) 337쌍·Network Panel(PNL-*) 49대·Edge PC(ED-*) 32대는
 * **Network Panel_260901_Rev.1 도면**(260903 교체판 · 조립 9 + 의장 7 도각) 기준 —
 * 도면 개정 시 painting `gen-assembly-lidar.py` 재실행 → `equipment.js` 갱신 →
 * `scripts/build-equipment-fixture.mjs` 재실행으로 다시 굽는다.
 * ⚠️ CAS·PAS 공장은 공정 분류 '가공' 그대로, 실적 권역만 조립 취급(사용자 확정) — 재분류 금지.
 */
import { RAW_EQUIPMENT, RAW_EQUIPMENT_TYPES } from './equipmentFixture'
import type { EquipmentPanel, YardEquipment, YardEquipmentType } from './types'

export type { EquipmentPanel, YardEquipment, YardEquipmentType } from './types'

/* 상태(운전) 계약과 그 mock — 화면은 여기서 함께 받는다.
 * (statusMock 이 이 파일을 되부르지만 함수 본문 안에서만 쓰므로 초기화 순환은 없다.) */
export type {
  CollectorState,
  EdgePcStatus,
  EquipmentPanelStatus,
  LinkState,
  TiltMode,
  TiltModuleStatus,
} from './status'
export { EDGE_STALE_AFTER_MS, isEdgeStale, panelHealthOf } from './status'
export {
  equipmentLinkOf,
  mockEdgePcStatus,
  mockEdgePcStatusById,
  mockPanelStatus,
  mockTiltStatus,
  mockTiltStatusById,
} from './statusMock'

/* 상태 조회의 **공식 계약** — 화면은 mock 함수가 아니라 이쪽을 부른다(`statusApi.ts` 주석 참조) */
export type { EquipmentStatusSnapshot } from './statusApi'
export {
  EMPTY_EQUIPMENT_STATUS,
  buildEquipmentStatusSnapshot,
  buildFactoryStatusSnapshot,
  edgePcStatusIn,
  equipmentIdsOfFactory,
  fetchEquipmentStatuses,
  fetchFactoryEquipmentStatuses,
  linkIn,
  panelStatusIn,
  tiltStatusIn,
} from './statusApi'
/* 흐르는 값(구독)으로 읽는 훅은 `./useEquipmentStatus` 에서 바로 받는다 — 이 파일은
 * React 를 끌어들이지 않는다(노드 환경의 규칙 테스트가 이 진입점을 그대로 읽는다). */

/** 설비 종류 레지스트리 — 원본 equipment-types.js 순서 그대로 */
export const EQUIPMENT_TYPES: readonly YardEquipmentType[] = RAW_EQUIPMENT_TYPES.map(
  ([id, name, symbol, color, note]) => ({ id, name, symbol, color, note })
)

const typeById = new Map(EQUIPMENT_TYPES.map((t) => [t.id, t]))

/** 야드 설비 전체 (841대) — 원본 equipment.js 순서 그대로 */
export const YARD_EQUIPMENT: readonly YardEquipment[] = RAW_EQUIPMENT.map(
  ([id, typeId, factory, bay, panelId, lat, lon, x, y]) => ({
    id,
    typeId,
    factory,
    bay,
    panelId,
    lat,
    lon,
    x,
    y,
  })
)

const equipmentById = new Map(YARD_EQUIPMENT.map((e) => [e.id, e]))

/** 설비ID → 설비 (모르는 ID 는 null — 없는 설비를 지어내지 않는다) */
export function yardEquipmentOf(id: string): YardEquipment | null {
  return equipmentById.get(id) ?? null
}

/** 종류ID → 종류 (모르는 ID 는 null — 없는 종류를 지어내지 않는다) */
export function equipmentTypeOf(typeId: string): YardEquipmentType | null {
  return typeById.get(typeId) ?? null
}

/** 특정 종류들의 설비만 — 도장(DH/GH)·조립(LIDAR/TILT) 화면이 자기 몫을 거를 때 쓴다 */
export function equipmentOfTypes(typeIds: readonly string[]): YardEquipment[] {
  const wanted = new Set(typeIds)
  return YARD_EQUIPMENT.filter((e) => wanted.has(e.typeId))
}

/* ── 라이다 ↔ 틸팅 페어 ─────────────────────────────────────────
 * 근거는 **설비ID 규칙**뿐이다: `LD-{꼬리}` 와 `PT-{꼬리}` 가 한 쌍이고, 같은 공장·베이·
 * 캐비닛에 선다. 원본 `equipment-links.js` 는 헤더만 있고 비어 있어 링크 데이터로는
 * 이을 수 없다 — 생성기가 매 빌드마다 쌍의 존재·소속 일치를 검사하므로 여기서는 규칙만
 * 편다. (링크 데이터가 채워지면 이 함수의 구현만 그쪽으로 바꾸면 된다.)
 */
const PAIR_PREFIX = { LIDAR: 'LD-', TILT: 'PT-' } as const

/** 페어 상대의 설비ID — 페어 대상이 아니면 null */
export function pairIdOf(equipment: YardEquipment): string | null {
  if (equipment.typeId === 'LIDAR' && equipment.id.startsWith(PAIR_PREFIX.LIDAR))
    return `${PAIR_PREFIX.TILT}${equipment.id.slice(PAIR_PREFIX.LIDAR.length)}`
  if (equipment.typeId === 'TILT' && equipment.id.startsWith(PAIR_PREFIX.TILT))
    return `${PAIR_PREFIX.LIDAR}${equipment.id.slice(PAIR_PREFIX.TILT.length)}`
  return null
}

/** 페어 상대 설비 — 없으면 null */
export function pairOf(equipment: YardEquipment): YardEquipment | null {
  const id = pairIdOf(equipment)
  return id ? (equipmentById.get(id) ?? null) : null
}

/** 라이다-틸팅 페어 전체 — 라이다 기준(라이다 1대 = 페어 1개) */
export function lidarTiltPairs(): { lidar: YardEquipment; tilt: YardEquipment }[] {
  const pairs: { lidar: YardEquipment; tilt: YardEquipment }[] = []
  for (const e of YARD_EQUIPMENT) {
    if (e.typeId !== 'LIDAR') continue
    const tilt = pairOf(e)
    if (tilt) pairs.push({ lidar: e, tilt })
  }
  return pairs
}

/* ── 캐비닛(패널) 기준정보 ────────────────────────────────────── */

/** 캐비닛으로 쓰이는 종류ID — 이 둘만 `panelId` 의 대상이 된다 */
export const CABINET_TYPE_IDS = ['PNL', 'EDGE'] as const

function buildPanels(): EquipmentPanel[] {
  const members = new Map<string, YardEquipment[]>()
  for (const e of YARD_EQUIPMENT) {
    if (!e.panelId) continue
    const list = members.get(e.panelId)
    if (list) list.push(e)
    else members.set(e.panelId, [e])
  }
  return YARD_EQUIPMENT.filter((e) => e.typeId === 'PNL' || e.typeId === 'EDGE').map((e) => {
    const list = members.get(e.id) ?? []
    const byType: Record<string, number> = {}
    for (const m of list) byType[m.typeId] = (byType[m.typeId] ?? 0) + 1
    return {
      id: e.id,
      kind: e.typeId === 'EDGE' ? ('edge-pc' as const) : ('network-panel' as const),
      typeId: e.typeId,
      factory: e.factory,
      bay: e.bay,
      lat: e.lat,
      lon: e.lon,
      memberIds: list.map((m) => m.id),
      memberCountByType: byType,
      memberBays: [...new Set(list.map((m) => m.bay).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    }
  })
}

/**
 * 캐비닛 전체 (Network Panel + Edge PC) — 설비 목록의 `panelId` 를 뒤집어 만든 파생값.
 * 모듈 로드 때 한 번만 세고, 소비자는 같은 배열을 참조한다.
 */
export const EQUIPMENT_PANELS: readonly EquipmentPanel[] = buildPanels()

const panelById = new Map(EQUIPMENT_PANELS.map((p) => [p.id, p]))

/** 캐비닛ID → 캐비닛 (모르는 ID 는 null) */
export function equipmentPanelOf(panelId: string): EquipmentPanel | null {
  return panelById.get(panelId) ?? null
}

/** 한 공장의 캐비닛 — 설비 배치 화면이 공장을 골랐을 때 */
export function panelsOfFactory(factory: string): EquipmentPanel[] {
  return EQUIPMENT_PANELS.filter((p) => p.factory === factory)
}

/** 캐비닛에 물린 설비 — 원본 순서 그대로 */
export function equipmentOfPanel(panelId: string): YardEquipment[] {
  return YARD_EQUIPMENT.filter((e) => e.panelId === panelId)
}

/**
 * "이 캐비닛이 죽으면 무엇이 같이 죽는가" — 종류별 대수와 페어 수.
 *
 * 라이다·틸팅은 한 쌍이 한 자리를 이루므로 대수만으로는 영향이 과장돼 읽힌다
 * (18대 ≠ 18곳). `pairs` 를 함께 내서 화면이 "라이다 9쌍"으로 말할 수 있게 한다.
 */
export function panelImpact(panelId: string): {
  total: number
  byType: Record<string, number>
  lidarPairs: number
} {
  const panel = panelById.get(panelId)
  if (!panel) return { total: 0, byType: {}, lidarPairs: 0 }
  const byType = { ...panel.memberCountByType }
  return {
    total: panel.memberIds.length,
    byType,
    lidarPairs: byType.LIDAR ?? 0,
  }
}
