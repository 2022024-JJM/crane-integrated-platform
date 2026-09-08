import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '..'

/**
 * 공장 → 베이 → 지번 매핑의 **정합성**.
 *
 * `parcelBaysFixture.ts` 는 `scripts/build-yard-parcel-bays.mjs` 가 원본 엑셀에서 다시
 * 만드는 생성물이라, 원본이 바뀌면 조용히 어긋날 수 있다 — 지도에 없는 공장·지번을
 * 가리키는 베이는 화면에서 **빈 자리**가 되고, 그 자리는 아무 오류도 내지 않는다.
 * 그래서 지도가 아니라 여기서 잡는다.
 */
describe('야드 지번 fixture 의 베이', () => {
  it('모든 베이가 실재하는 공장과 지번만 가리킨다', async () => {
    const { bays, factories, lots } = await loadYardParcels()
    const factoryNames = new Set(factories.map((f) => f.name))
    const lotCodes = new Set(lots.map((lot) => lot.lot))

    const unknownFactories = [...new Set(bays.map((b) => b.factory))].filter(
      (name) => !factoryNames.has(name)
    )
    const unknownLots = bays.flatMap((b) => b.lotCodes.filter((code) => !lotCodes.has(code)))

    expect(unknownFactories).toEqual([])
    expect(unknownLots).toEqual([])
  })

  it('베이 id 는 유일하고 지번은 베이 하나에만 든다', async () => {
    const { bays } = await loadYardParcels()
    expect(new Set(bays.map((b) => b.id)).size).toBe(bays.length)

    /* 한 지번이 두 베이에 들면 그 지번은 두 스팬에 겹쳐 그려진다 */
    const owner = new Map<string, string>()
    const shared: string[] = []
    for (const bay of bays) {
      for (const code of bay.lotCodes) {
        const first = owner.get(code)
        if (first) shared.push(`${code}: ${first} / ${bay.id}`)
        else owner.set(code, bay.id)
      }
    }
    expect(shared).toEqual([])
  })

  it('조립 7개 공장이 모두 베이를 갖는다 — 3D 로 세우는 대상이 빠지지 않도록', async () => {
    const { bays, factories } = await loadYardParcels()
    const assembly = factories.filter((f) => f.process === '조립').map((f) => f.name)
    const withBays = new Set(bays.map((b) => b.factory))

    expect(assembly.filter((name) => !withBays.has(name))).toEqual([])
    /* PBS 는 본동 6 + 꺾인 별동 2 = 8 스팬. 개수가 줄면 매핑이 깨진 것이다 */
    expect(bays.filter((b) => b.factory === 'PBS')).toHaveLength(8)
  })

  it('2026-09 원본 개편분이 실려 있다 — 베이 132 · B21 신설 · 느태 NP5/NP6 분할', async () => {
    const { bays } = await loadYardParcels()
    /* bays.js 정본 132건이 전부 살아야 한다 — 줄면 생성기가 지번·공장을 걸러낸 것 */
    expect(bays).toHaveLength(132)

    /* 1DOCK B21(보온셀터, 실측 4필지 1DW100~103) — 신설 베이 */
    const b21 = bays.find((b) => b.id === '1DOCK 도장공장#B21')
    expect(b21?.lotCodes.slice().sort()).toEqual(['1DW100', '1DW101', '1DW102', '1DW103'])

    /* 느태 NP5 → NP5/NP6 분할 — 정반 4장씩 나뉘어야 한다 */
    const np5 = bays.find((b) => b.id === '느태 도장공장#NP5')
    const np6 = bays.find((b) => b.id === '느태 도장공장#NP6')
    expect(np5?.lotCodes.slice().sort()).toEqual(['NP0201', 'NP0202', 'NP0203', 'NP0204'])
    expect(np6?.lotCodes.slice().sort()).toEqual(['NP0211', 'NP0212', 'NP0213', 'NP0214'])

    /* 베이명은 공장 안에서만 유일 — 숫자 베이가 여러 공장에 겹치므로 복합키가 강제다 */
    const bayNames = new Set(bays.map((b) => b.bay))
    expect(bayNames.size).toBeLessThan(bays.length)
    expect(new Set(bays.map((b) => b.bayKey)).size).toBe(bays.length)
  })
})
