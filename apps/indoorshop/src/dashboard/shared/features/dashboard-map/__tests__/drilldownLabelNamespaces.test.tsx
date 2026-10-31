import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { listBlocks } from '../../../entities/vessel'

/*
 * 드릴다운 라벨의 **이름 공간 계약** — UX 감사 F-42 에 대한 적대적 검증(W7-6V).
 *
 * (실적 배지는 야드 맵에서 걷혔다. 같은 이름 공간을 지금은 베이 재실·작업 카드가 쓴다 —
 * 로스터 공장명이 지도에 없으면 그 블록은 어느 베이 카드에도 서지 않는다.)
 *
 * 이웃한 `performanceBadgeRoster.test.tsx` 는 "배지에 뜬 블록 라벨이 로스터에 실재하고
 * 검색에도 걸린다"를 잠근다. 다만 그 테스트는 배지에 넘기는 공장 이름을 **로스터에서**
 * 뽑아 쓴다(`listBlocks().map(b => b.factory)`). 실제 화면은 그렇지 않다 —
 * `DashboardZoneMap` 은 지번 fixture 에서 나온 이름을 넘긴다:
 *   · L832  `<PerformanceBadge factory={selectedBayData.factory} process="조립" />`  ← parcels.bays[].factory
 *   · L1855 `<PerformanceBadge factory={data.name} process="조립" />`                ← parcels.factories[].name
 *
 * 즉 두 이름 공간(로스터 ↔ 지번 fixture)이 문자열로 맞물려야만 배지가 선다. 한쪽만
 * 이름을 고치면 배지는 **조용히 사라지고**(배지는 데이터 없는 공장에서 스스로 빠진다)
 * 아무 테스트도 깨지지 않는다. "표기≠검색"의 진짜 사고 계급은 잘못된 라벨보다 이쪽이다.
 *
 * 여기서는 지도가 만들어 낼 수 있는 이름을 **지도 쪽에서** 가져와 계약을 건다.
 */

describe('드릴다운 배지 이름 공간 (지번 fixture ↔ 로스터)', () => {
  it('로스터가 블록을 가진 공장은 모두 지번 fixture 에도 같은 이름으로 있다', async () => {
    const parcels = await loadYardParcels()
    const mapNames = new Set([
      ...parcels.factories.map((f) => f.name),
      ...parcels.bays.map((b) => b.factory),
    ])

    const rosterFactories = [...new Set(listBlocks().map((b) => b.factory))]
    expect(rosterFactories.length).toBeGreaterThan(0)

    const orphans = rosterFactories.filter((name) => !mapNames.has(name))
    expect(
      orphans,
      `로스터에만 있는 공장명 — 지도가 이 이름을 넘길 수 없으니 배지가 영영 안 뜬다: ${orphans.join(', ')}`
    ).toEqual([])
  })
})
