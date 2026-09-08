import type { YardParcels } from '../../../entities/yard-parcels'
import type { ProcessMapLocation } from '../../../model/processMapDrilldown'

/*
 * 지도에서 고른 **베이 한 칸**의 상세 — 그 베이가 무엇으로 이뤄져 있는가.
 *
 * 지도의 베이는 `공장-베이-지번` 매핑(엑셀)이 준 스팬이고, 그 스팬은 지번 한~네 장으로
 * 이뤄진다. 베이를 눌렀을 때 사람이 알고 싶은 것은 "이 스팬이 어느 지번들이고, 그 지번이
 * 원본에서 뭐라고 불리는가"이며, 그 이름이 곧 원본의 **설명** 열(`YardParcelLot.label`)이다.
 * 여기서 새로 만드는 값은 없다 — fixture 가 이미 가진 것을 베이 단위로 모을 뿐이다.
 *
 * 화면(React)에서 떼어 순수 함수로 두는 이유는 이 레포의 다른 파생 계산과 같다: 집계
 * 규칙이 UI 안에 있으면 검증할 수가 없다.
 */

/** 베이를 이루는 지번 한 장 */
export interface BayLotDetail {
  /** 지번코드 (예: `PB3B01`) */
  lot: string
  /** 원본(엑셀·painting)의 `설명` 열 그대로 — 예: `PBS 5 BAY 남쪽-01` */
  description: string
  /** 면적 (m²) */
  area: number
  /** 옥내 / 옥외 */
  place: string
  /** 분류(CATC) — 색이 뜻하는 단위 */
  category: string
}

/** 베이 하나의 상세 카드에 필요한 것 전부 */
export interface BaySummary {
  /** `YardParcelBay.id` — `{공장}#{베이}` */
  id: string
  factory: string
  /** 화면에 쓰는 이름 (예: `3BAY`) */
  label: string
  /** 소속 공장의 공정. 모르면 null */
  process: string | null
  lots: BayLotDetail[]
  /** 소속 지번 면적의 합 (m²) */
  area: number
  indoor: number
  outdoor: number
}

/**
 * 베이 하나를 상세로 편다. 매핑에 없는 베이거나 지도 fixture 에 지번이 하나도 없으면 null —
 * 빈 카드를 세우느니 카드를 열지 않는 편이 낫다.
 *
 * 지번 순서는 **매핑이 준 순서 그대로** 둔다(`PB1B01`, `PB1B02`, …). 원본이 이미 베이 안의
 * 자리 순으로 적어 두었고, 여기서 다시 정렬하면 그 순서를 잃는다.
 */
export function summarizeBay(parcels: YardParcels, bayId: string): BaySummary | null {
  const bay = parcels.bays.find((b) => b.id === bayId)
  if (!bay) return null

  const byCode = new Map(parcels.lots.map((lot) => [lot.lot, lot]))
  const lots: BayLotDetail[] = []
  let area = 0
  let indoor = 0
  let outdoor = 0
  for (const code of bay.lotCodes) {
    const lot = byCode.get(code)
    if (!lot) continue
    lots.push({
      lot: lot.lot,
      description: lot.label,
      area: lot.area,
      place: lot.place,
      category: lot.category,
    })
    area += lot.area
    if (lot.place === '옥내') indoor += 1
    else if (lot.place === '옥외') outdoor += 1
  }
  if (lots.length === 0) return null

  return {
    id: bay.id,
    factory: bay.factory,
    label: bay.label,
    process: parcels.factories.find((f) => f.name === bay.factory)?.process ?? null,
    lots,
    area,
    indoor,
    outdoor,
  }
}

/**
 * 지도의 베이 ↔ 공정 모듈의 작업 위치(조립: 정반)를 **지번으로** 잇는다.
 *
 * 둘은 다른 자료에서 나온 다른 단위다 — 지도의 베이는 지번 매핑이 준 건물 스팬이고,
 * 작업 위치는 공정 모듈이 소유한 운영 단위라 개수도 이름도 어긋날 수 있다(PBS 는 지도
 * 8베이 · 조립 3정반). 이름을 맞춰 잇는 것은 두 자료가 같은 이름 규칙을 쓴다는 가정이라
 * 언제든 깨진다. 지번은 두 자료가 **함께 가리키는 유일한 실물**이라, 겹치는 지번이 가장
 * 많은 것을 짝으로 본다. 겹치는 것이 하나도 없으면 짝이 없다(null) — 없는 링크를 만들지 않는다.
 */
export function locationOfBay(
  locations: readonly ProcessMapLocation[],
  bayLotCodes: readonly string[]
): ProcessMapLocation | null {
  const codes = new Set(bayLotCodes)
  let best: ProcessMapLocation | null = null
  let bestShared = 0
  for (const location of locations) {
    const shared = (location.yardLotCodes ?? []).filter((code) => codes.has(code)).length
    if (shared > bestShared) {
      bestShared = shared
      best = location
    }
  }
  return best
}
