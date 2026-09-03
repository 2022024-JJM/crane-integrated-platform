import {
  YARD_EQUIPMENT,
  equipmentPanelOf,
  equipmentTypeOf,
  linkIn,
  panelStatusIn,
  type EquipmentPanelStatus,
  type EquipmentStatusSnapshot,
  type LinkState,
  type YardEquipment,
} from '../../../shared/entities/equipment'

/*
 * 도장 공장의 **설비 인벤토리** — SCADA 자산(DH/GH) 밖의 것까지 한 자리에서 센다.
 *
 * 지금까지 도장 화면이 아는 설비는 제습기·가스히터 86대뿐이었다. 그런데 설비 마스터
 * (`shared/entities/equipment`)에는 제어반(PLC)·스위치허브(HUB)·네트워크 판넬(PNL)·
 * Edge PC(EDGE) 같은 **이관 설비** 종류가 함께 등록돼 있고, 도면이 개정되면 도장 공장
 * 몫도 이 표로 들어온다. 그래서 화면이 DH/GH 를 하드코딩해 세지 않고 **공장에 실제로
 * 등록된 것을 그대로** 읽게 한다 — 도면이 도장 판넬을 데려오는 날 화면은 손대지 않는다.
 *
 * ⚠️ 2026-09-03 현재 도장 5개 공장의 이관 설비는 **0대**다(도면집에도 도장 공장은 없다).
 *    그것이 정상이며, 화면은 그 사실을 빈 자리로 정직하게 말한다 — 없는 설비를 지어내
 *    세우지 않는다.
 */

/** SCADA 자산 — 도장이 원래부터 보던 것 */
export const PAINTING_SCADA_TYPE_IDS: readonly string[] = ['DH', 'GH']

/**
 * 이관 설비 — 260903 교체판 도면이 데려온 제어·네트워크 자산.
 * 캐비닛(PNL/EDGE)을 앞에 둔다: 이 판이 죽으면 아래가 통째로 눈이 먼다.
 */
export const PAINTING_TRANSFERRED_TYPE_IDS: readonly string[] = ['PNL', 'EDGE', 'PLC', 'HUB']

/** 종류 한 줄 — 대수와 (있으면) 연결 상태 집계 */
export interface PaintingTypeCount {
  typeId: string
  /** 사람이 읽는 이름 — 레지스트리에 없으면 종류ID 그대로 */
  name: string
  count: number
}

/** 이관 설비 한 대 — 캐비닛이면 판정·영향 범위가 함께 선다 */
export interface PaintingTransferredUnit {
  equipment: YardEquipment
  typeName: string
  link: LinkState
  /** 캐비닛(PNL/EDGE)일 때만 — 전원·업링크·소속 대수 */
  panelStatus: EquipmentPanelStatus | null
}

export interface PaintingFactoryInventory {
  factory: string
  /** SCADA 자산 종류별 대수 (DH/GH) */
  scada: PaintingTypeCount[]
  scadaTotal: number
  /** 이관 설비 종류별 대수 — 비어 있으면 이 공장엔 아직 없다 */
  transferred: PaintingTypeCount[]
  transferredTotal: number
  /** 이관 설비 개별 — 목록에 그대로 편다 */
  transferredUnits: PaintingTransferredUnit[]
  /** 이상(오프라인·오류·판넬 down)인 이관 설비 수 — 카드 테두리의 근거 */
  transferredIssues: number
}

/** 공장별로 미리 갈라 둔다 — 공장을 고를 때마다 841대를 훑지 않도록 */
const byFactory = new Map<string, YardEquipment[]>()
for (const item of YARD_EQUIPMENT) {
  const bucket = byFactory.get(item.factory)
  if (bucket) bucket.push(item)
  else byFactory.set(item.factory, [item])
}

function countsOf(items: readonly YardEquipment[], typeIds: readonly string[]): PaintingTypeCount[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (!typeIds.includes(item.typeId)) continue
    counts.set(item.typeId, (counts.get(item.typeId) ?? 0) + 1)
  }
  /* 종류 순서는 위 상수의 순서를 따른다 — 대수 순으로 뒤섞으면 폴링마다 줄이 춤춘다 */
  return typeIds
    .filter((typeId) => (counts.get(typeId) ?? 0) > 0)
    .map((typeId) => ({
      typeId,
      name: equipmentTypeOf(typeId)?.name ?? typeId,
      count: counts.get(typeId) ?? 0,
    }))
}

/**
 * 공장 한 곳의 설비 인벤토리. 상태는 **스냅샷으로 주입받는다**(`shared/entities/equipment`
 * 의 `fetchFactoryEquipmentStatuses`) — 여기서 원천을 직접 부르면 이 순수 계산이 망을
 * 타게 되고, 실연동 때 화면까지 함께 바뀐다.
 */
export function paintingInventoryOf(
  factory: string,
  snapshot: EquipmentStatusSnapshot
): PaintingFactoryInventory {
  const items = byFactory.get(factory) ?? []
  const transferredUnits: PaintingTransferredUnit[] = []
  let transferredIssues = 0

  for (const typeId of PAINTING_TRANSFERRED_TYPE_IDS) {
    for (const item of items) {
      if (item.typeId !== typeId) continue
      const panel = equipmentPanelOf(item.id)
      const panelStatus = panel ? panelStatusIn(snapshot, panel.id) : null
      const link = linkIn(snapshot, item.id) ?? 'offline'
      /* 캐비닛은 자기 종합 판정(status.health)이 정본이다 — 여기서 다시 세지 않는다 */
      const bad = panelStatus ? panelStatus.health !== 'healthy' : link !== 'online'
      if (bad) transferredIssues += 1
      transferredUnits.push({
        equipment: item,
        typeName: equipmentTypeOf(item.typeId)?.name ?? item.typeId,
        link,
        panelStatus,
      })
    }
  }

  const scada = countsOf(items, PAINTING_SCADA_TYPE_IDS)
  const transferred = countsOf(items, PAINTING_TRANSFERRED_TYPE_IDS)

  return {
    factory,
    scada,
    scadaTotal: scada.reduce((sum, row) => sum + row.count, 0),
    transferred,
    transferredTotal: transferred.reduce((sum, row) => sum + row.count, 0),
    transferredUnits,
    transferredIssues,
  }
}

/* ══ 설비 상태 단의 구성 (W6-6) ══════════════════════════════════
 *
 * 조립·의장이 쓰는 것과 **같은 계약**이다(`EquipmentSection` — 종류ID·대수·접힘·묶음).
 * 순서 원칙도 같다: **가동 자산 먼저, 수집·네트워크 나중.** 조립·의장이 라이다 → 틸팅 →
 * Edge PC → 캐비닛인 자리에, 도장은 제습기 → 가스히터 → Edge PC → 캐비닛 → PLC → 허브다.
 * 대수 0인 종류는 구획을 만들지 않는다(빈 제목만 남는 자리를 두지 않는다).
 */

/** 설비 상태 단의 구획 하나 — 조립 `EquipmentSection` 과 같은 모양 */
export interface PaintingEquipmentSection {
  typeId: string
  count: number
  /** 접어 두는 구획인가 — 도장은 아직 없다(모든 종류가 한 목록에 다 선다) */
  collapsible: boolean
  /** 베이별로 나뉘는 구획인가 (SCADA 자산만 — 랙이 이미 베이 단위로 읽힌다) */
  groups?: { bay: string; ids: string[] }[]
}

/** 구획 순서 — 가동 자산(DH·GH) 먼저, 수집·네트워크(EDGE·PNL·PLC·HUB) 나중 */
export const PAINTING_SECTION_ORDER: readonly string[] = [
  ...PAINTING_SCADA_TYPE_IDS,
  'EDGE',
  'PNL',
  'PLC',
  'HUB',
]

/** 공장 하나의 설비 구획 — 화면이 세지 않고 여기서 센다 */
export function paintingEquipmentSections(factory: string): PaintingEquipmentSection[] {
  const items = byFactory.get(factory) ?? []
  const sections: PaintingEquipmentSection[] = []
  for (const typeId of PAINTING_SECTION_ORDER) {
    const ofType = items.filter((e) => e.typeId === typeId)
    if (ofType.length === 0) continue
    const scada = PAINTING_SCADA_TYPE_IDS.includes(typeId)
    sections.push({
      typeId,
      count: ofType.length,
      collapsible: false,
      groups: scada ? groupsByBay(ofType) : undefined,
    })
  }
  return sections
}

/** 베이 묶음 — 이름 순(숫자 섞임 고려). 베이가 없는 설비는 빈 이름으로 한 묶음에 든다 */
function groupsByBay(items: readonly YardEquipment[]): { bay: string; ids: string[] }[] {
  const map = new Map<string, string[]>()
  for (const item of items) {
    const list = map.get(item.bay)
    if (list) list.push(item.id)
    else map.set(item.bay, [item.id])
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([bay, ids]) => ({ bay, ids }))
}
