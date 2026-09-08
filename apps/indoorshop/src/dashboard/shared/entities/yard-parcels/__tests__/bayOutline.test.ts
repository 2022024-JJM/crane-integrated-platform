import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '..'
import { outlineOf } from '../../../features/yard-map/lib/bayGable'
import { polygonArea } from '../../../features/yard-map/lib/footprint'

/**
 * 베이 발자국이 **지면의 2D 지번선과 정확히 같은가**.
 *
 * 지도는 베이를 소속 지번을 합친 경계로 세운다. 그 경계를 못 만들면 볼록 껍질로 물러나고,
 * 그러면 폭이 다른 칸이 있는 베이(NPS 3BAY: 19m 칸 + 43m 칸)에서 발자국이 지번선 밖으로
 * 부푼다 — 화면에서는 3D 가 2D 에서 어긋난 것으로 보인다. 그 회귀를 여기서 잡는다.
 */
describe('베이 발자국', () => {
  it('조립 베이의 경계는 소속 지번의 합집합과 넓이가 같다 — 껍질로 물러나지 않는다', async () => {
    const { bays, factories, lots } = await loadYardParcels()
    const polygon = new Map(lots.map((lot) => [lot.lot, lot.polygon]))
    const assembly = new Set(
      factories.filter((f) => f.process === '조립').map((f) => f.name)
    )

    const bulged: string[] = []
    let checked = 0
    for (const bay of bays) {
      if (!assembly.has(bay.factory)) continue
      const polygons = bay.lotCodes.map((code) => polygon.get(code)).filter((p) => p != null)
      if (polygons.length === 0) continue
      checked++
      const outline = outlineOf(polygons)
      const merged = polygons.reduce((sum, p) => sum + polygonArea(p), 0)
      /* 지번끼리 겹치지 않으므로 합집합 넓이 = 낱장 넓이의 합 */
      if (outline == null || Math.abs(polygonArea(outline) - merged) > merged * 0.005) {
        bulged.push(`${bay.factory} ${bay.label}`)
      }
    }

    expect(checked).toBe(23)
    expect(bulged).toEqual([])
  })
})
