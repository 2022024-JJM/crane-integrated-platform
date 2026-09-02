import { OUTFITTING_FACTORIES, type OutfittingFactorySpec } from '../api/outfittingFactoryFixture'
import type { OutfittingBlock } from '../model/block'

/*
 * 지도의 베이 ↔ 의장 블록을 **지번으로** 잇는 순수 계산.
 *
 * 두 자료는 단위가 다르다 — 지도의 베이(parcelBaysFixture)는 지번 매핑이 준 건물 스팬이고,
 * 블록은 의장 fixture 의 구역(area) 위에 산다. 이름을 맞춰 잇는 것은 두 자료가 같은 이름
 * 규칙을 쓴다는 가정이라 언제든 깨진다(dashboard-map 의 locationOfBay 와 같은 사정).
 * 지번은 두 자료가 함께 가리키는 유일한 실물이므로, 구역마다 **지번이 가장 많이 겹치는
 * 베이 하나**에 배정한다 — 한 구역이 여러 베이에 걸쳐도(POS1 본체) 블록이 베이마다
 * 중복해 서지 않는다. 겹치는 베이가 없는 구역은 배정하지 않는다(없는 링크를 만들지 않는다).
 */

/** 이 계산이 베이에게서 필요로 하는 최소 — YardParcelBay 의 부분집합 */
export interface BaySpanLike {
  /** `{공장}#{베이}` — YardParcelBay.id */
  id: string
  /** 소속 공장 이름 (지번 fixture 의 공장명 = 의장 fixture 의 name) */
  factory: string
  lotCodes: readonly string[]
}

/** 지번 fixture 공장명 → 의장 공장 스펙. 이름이 곧 연결 키다(fixture 가 같은 원본에서 파생) */
export function outfittingFactoryByName(name: string): OutfittingFactorySpec | undefined {
  return OUTFITTING_FACTORIES.find((factory) => factory.name === name)
}

/**
 * 베이 스팬들에 구역을 배정한다 — bayId → 그 베이 소속 areaCode[].
 *
 * 공장 단위로 닫힌 계산이다: 구역은 제 공장의 베이하고만 겹침을 잰다. 동률이면 먼저 온
 * 베이(fixture 순서)가 가진다 — 입력이 같으면 결과도 같아야 화면이 흔들리지 않는다.
 */
export function areasByBay(bays: readonly BaySpanLike[]): Map<string, string[]> {
  const assigned = new Map<string, string[]>()
  for (const factory of OUTFITTING_FACTORIES) {
    const factoryBays = bays.filter((bay) => bay.factory === factory.name)
    if (factoryBays.length === 0) continue
    for (const area of factory.areas) {
      const codes = new Set(area.yardLots)
      let best: BaySpanLike | null = null
      let bestShared = 0
      for (const bay of factoryBays) {
        const shared = bay.lotCodes.filter((code) => codes.has(code)).length
        if (shared > bestShared) {
          bestShared = shared
          best = bay
        }
      }
      if (!best) continue
      const list = assigned.get(best.id)
      if (list) list.push(area.code)
      else assigned.set(best.id, [area.code])
    }
  }
  return assigned
}

/** 한 베이의 블록 목록 — areasByBay 배정과 블록의 (factoryId, areaCode)로 거른다 */
export function blocksOfBay(
  blocks: readonly OutfittingBlock[],
  areasOfBay: readonly string[] | undefined,
  factoryName: string
): OutfittingBlock[] {
  if (!areasOfBay || areasOfBay.length === 0) return []
  const factory = outfittingFactoryByName(factoryName)
  if (!factory) return []
  const areaSet = new Set(areasOfBay)
  return blocks.filter((block) => block.factoryId === factory.id && areaSet.has(block.areaCode))
}
