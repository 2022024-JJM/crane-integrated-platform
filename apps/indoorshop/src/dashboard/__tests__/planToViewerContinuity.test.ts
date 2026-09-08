import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../shared/entities/yard-parcels'
import { birdviewBaysOf, birdviewRotationOf } from '../shared/features/equipment-birdview'
import { fitProjection } from '../shared/features/equipment-birdview/lib/projection'
import { fetchFactoryLayout } from '../processes/assembly/api/assemblyApi'
import { ASSEMBLY_FACTORIES } from '../processes/assembly/api/assemblyFactoryFixture'
import { PLAN_AZIMUTH, PLAN_VIEWPOINT } from '../shared/features/bay-viewer/lib/viewpoint'

/*
 * ── 도면과 3D 가 **같은 자세로** 선다 ──
 *
 * 현황 탭의 설비 배치는 베이 장변을 가로로 눕혀 그린다(R42). 3D 뷰어가 제 좌표 그대로
 * 서면 같은 공장이 두 그림에서 다른 각으로 눕고, 탭을 옮길 때마다 새 그림이 된다 —
 * 방금 읽은 도면과 지금 보는 장면이 이어지지 않으면 눈이 처음부터 다시 자리를 찾는다.
 *
 * 눈으로 한 공장만 맞춰 보고 넘어가면 나머지가 어긋난 채 남는다. 실제로 그랬다: 카메라가
 * 배치에서 축을 되계산하던 시절, 축이 mod 180° 로 접히면서 **3DS 만** 베이 순서가
 * 위아래 반대로 섰다(도면 1,2,3 ↔ 3D 3,2,1). 그래서 눈이 아니라 계산으로 못 박는다.
 *
 * 두 그림의 화면 y 를 각자 구해 **베이 순서**를 견준다. 절대 좌표는 견줄 수 없다(한쪽은
 * SVG 뷰박스, 한쪽은 원근 카메라다) — 견줄 수 있고 또 견뎌야 하는 것은 순서다.
 */

/** 3D 화면에서 아래로 갈수록 커지는 값 — 궤도 카메라의 화면 세로축에 투영한 것 */
function viewerScreenY(centerX: number, centerZ: number): number {
  const elevation = (PLAN_VIEWPOINT.elevationDeg * Math.PI) / 180
  return (
    (centerX * Math.sin(PLAN_AZIMUTH) + centerZ * Math.cos(PLAN_AZIMUTH)) * Math.sin(elevation)
  )
}

/**
 * **또렷하게 갈리는 짝**만 견준다.
 *
 * 나란히 선 베이(PBS 7·8 처럼 장변 방향으로만 떨어진 칸)는 화면 세로에서 사실상 같은
 * 자리라, 어느 쪽이 위인지는 원근 한 겹에 뒤집힌다. 그 뒤집힘은 자세가 어긋난 것이
 * 아니므로 계약으로 삼지 않는다 — 견줄 것은 "위아래로 떨어져 보이는 칸들의 순서"다.
 */
const TIE = 0.05

function significantPairs(plan: Map<string, number>): [string, string][] {
  const values = [...plan.values()]
  const span = Math.max(...values) - Math.min(...values)
  const keys = [...plan.keys()]
  const pairs: [string, string][] = []
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const gap = Math.abs(plan.get(keys[i])! - plan.get(keys[j])!)
      if (span > 0 && gap / span > TIE) pairs.push([keys[i], keys[j]])
    }
  }
  return pairs
}

/** 베이 번호만 — 도면은 `1`, 배치는 `1번 베이` 로 부른다 */
const bayNoOf = (text: string) => text.replace(/[^0-9]/g, '')

describe('도면 → 3D 뷰어 — 같은 공장이 같은 자세로 선다', () => {
  it.each(ASSEMBLY_FACTORIES.map((f) => [f.name, f.id] as const))(
    '%s — 베이 순서가 두 그림에서 같다',
    async (factoryName, factoryId) => {
      const parcels = await loadYardParcels()
      const bays = birdviewBaysOf(parcels.bays, factoryName)
      expect(bays.length, `${factoryName} 의 베이 외곽이 있어야 한다`).toBeGreaterThan(0)

      /* ① 도면 — 회전(R42)을 건 투영 위에서 베이 중심의 화면 y */
      const projection = fitProjection(
        bays.flatMap((bay) => [...bay.hull]),
        { width: 1000, height: 600, padding: 18, rotation: birdviewRotationOf(bays) }
      )
      expect(projection).not.toBeNull()
      const plan = new Map(
        bays.map((bay) => {
          const points = bay.hull.map(projection!.project)
          return [bayNoOf(bay.label), points.reduce((sum, p) => sum + p.y, 0) / points.length]
        })
      )

      /* ② 3D — 같은 공장의 배치를 기본 시점 카메라로 봤을 때의 화면 y */
      const layout = await fetchFactoryLayout(factoryId)
      const viewer = new Map(
        layout.bays.map((bay) => [bayNoOf(bay.name), viewerScreenY(bay.center[0], bay.center[1])])
      )

      /* 베이가 하나뿐인 공장(OFD2·OFD3)은 견줄 짝이 없다 — 순서가 없으면 어긋날 것도 없다 */
      const pairs = significantPairs(plan)
      if (bays.length > 1) expect(pairs.length, '견줄 짝이 있어야 한다').toBeGreaterThan(0)
      const flipped = pairs.filter(
        ([a, b]) =>
          Math.sign(plan.get(a)! - plan.get(b)!) !== Math.sign(viewer.get(a)! - viewer.get(b)!)
      )
      expect(flipped, `${factoryName} — 도면과 3D 의 위아래가 어긋난 짝`).toEqual([])
    }
  )
})
