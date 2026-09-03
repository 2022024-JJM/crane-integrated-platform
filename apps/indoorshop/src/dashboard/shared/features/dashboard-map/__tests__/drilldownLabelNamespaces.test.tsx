import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../lib/testing/renderWithProviders'
import { PerformanceBadge } from '../ui/PerformanceBadge'
import { loadYardParcels } from '../../../entities/yard-parcels'
import { blocksAtFactory, listBlocks } from '../../../entities/vessel'

/*
 * 드릴다운 라벨의 **이름 공간 계약** — UX 감사 F-42 에 대한 적대적 검증(W7-6V).
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

  it('지도가 넘기는 이름 그대로 배지를 그려도 로스터 블록이 나온다 (실제 호출 경로)', async () => {
    const parcels = await loadYardParcels()

    /* 지도 쪽 이름 중 로스터에 블록이 있는 것 — 화면에서 배지가 실제로 서는 자리 전부 */
    const mapNamesWithBlocks = [
      ...new Set([
        ...parcels.factories.map((f) => f.name),
        ...parcels.bays.map((b) => b.factory),
      ]),
    ].filter((name) => blocksAtFactory(name).length > 0)

    expect(
      mapNamesWithBlocks.length,
      '지도 이름으로 배지가 서는 공장이 하나도 없다 — 두 이름 공간이 어긋났다'
    ).toBeGreaterThan(0)

    for (const name of mapNamesWithBlocks) {
      const { unmount } = renderWithProviders(<PerformanceBadge factory={name} process="조립" />)
      /* 지도 이름을 그대로 넘겼을 때 라벨이 실제로 서는지 — 안 서면 배지가 조용히 빈 것 */
      const labels = await screen.findAllByText(/^\d+-\w+$/)
      expect(labels.length, `${name}: 지도 이름으로는 배지가 비어 있다`).toBeGreaterThan(0)
      unmount()
    }
  })
})
