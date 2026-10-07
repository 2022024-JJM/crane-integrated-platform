import { describe, expect, it } from 'vitest'
import { loadYardParcels } from '../shared/entities/yard-parcels'
import { birdviewBaysOf, birdviewRotationOf } from '../shared/features/equipment-birdview'
import { fitProjection } from '../shared/features/equipment-birdview/lib/projection'
import { fetchFactoryLayout } from '../processes/assembly/api/assemblyApi'
import { ASSEMBLY_FACTORIES } from '../processes/assembly/api/assemblyFactoryFixture'
import {
  fetchEquipmentByFactory,
  paintingFactories,
} from '../processes/painting/api/paintingRepository'
import { loadPaintingFloorPlan } from '../processes/painting/lib/floorPlan'
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

/*
 * ── 도장 가동 뷰도 같은 자세로 선다 ──
 *
 * 도장의 3D(가동 뷰)는 점군이 아니라 공기를 그리지만, 서는 자세는 같은 계약을 진다 —
 * 현황 탭의 배치도에서 `가동 뷰` 로 건너가는 것은 조립·의장에서 3D 로 건너가는 것과
 * 같은 이동이기 때문이다.
 *
 * 여기서 더 잡히는 것은 **축의 90° 오차**다. 도장 베이는 한 면이 58×56m 로 정사각에
 * 가까워, 최소면적 직사각형이 두 직각 방향 중 아무 쪽이나 고른다. 배치(`floorPlan`)가
 * 넓이만으로 축을 평균하던 시절 2DOCK 도장공장이 그렇게 90° 옆으로 앉았다 — 도면에서
 * 위에 있던 C 줄이 가동 뷰에서는 아래에 섰다. 지금은 배치가 도면과 **같은 각**을
 * 받아 쓰므로(`birdviewRotationOf`) 어긋날 자리가 없고, 그 사실을 여기서 잠근다.
 */

/** 도장 베이 한 면 — 견줄 수 있는 최소한 */
interface PlanPoint {
  x: number
  y: number
}

/**
 * **위아래로 갈리는 짝**만 견준다 — 도장은 조립보다 한 겹 더 걸러야 한다.
 *
 * 도장 공장은 정사각에 가까운 베이가 격자로 서 있어, 두 베이의 가로 간격과 세로 간격이
 * 엇비슷한 짝이 흔하다. 기본 시점은 도면을 오른쪽으로 16° 튼 각이므로(`PLAN_VIEWPOINT`),
 * 그런 짝은 **자세가 맞아도** 기울임 한 겹에 위아래가 바뀐다 — 그 뒤집힘은 어긋남이
 * 아니라 3D 로 온 대가다. 그래서 세로 간격이 가로 간격을 넘는 짝(도면에서 "윗줄/아랫줄"로
 * 읽히는 짝)만 계약으로 삼는다.
 */
function verticalPairs(plan: Map<string, PlanPoint>): [string, string][] {
  const values = [...plan.values()].map((p) => p.y)
  const span = Math.max(...values) - Math.min(...values)
  const keys = [...plan.keys()]
  const pairs: [string, string][] = []
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const a = plan.get(keys[i])!
      const b = plan.get(keys[j])!
      const gapY = Math.abs(a.y - b.y)
      if (!(span > 0 && gapY / span > TIE)) continue
      if (gapY <= 0.5 * Math.abs(a.x - b.x)) continue
      pairs.push([keys[i], keys[j]])
    }
  }
  return pairs
}

describe('도면 → 도장 가동 뷰 — 같은 공장이 같은 자세로 선다', () => {
  it.each(paintingFactories().map((name) => [name] as const))(
    '%s — 베이 순서가 두 그림에서 같다',
    async (factoryName) => {
      const parcels = await loadYardParcels()
      const bays = birdviewBaysOf(parcels.bays, factoryName)
      expect(bays.length, `${factoryName} 의 베이 외곽이 있어야 한다`).toBeGreaterThan(0)

      /* ① 도면 — 현황 탭이 그리는 그대로(회전 R42)의 베이 중심 */
      const projection = fitProjection(
        bays.flatMap((bay) => [...bay.hull]),
        { width: 1000, height: 600, padding: 18, rotation: birdviewRotationOf(bays) }
      )
      expect(projection).not.toBeNull()
      const plan = new Map(
        bays.map((bay) => {
          const points = bay.hull.map(projection!.project)
          return [
            bay.label,
            {
              x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
              y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
            },
          ]
        })
      )

      /* ② 가동 뷰 — 같은 공장의 바닥 배치를 기본 시점 카메라로 봤을 때 */
      const equipmentBays = [
        ...new Set(fetchEquipmentByFactory(factoryName).map((item) => item.bay)),
      ]
      const floor = await loadPaintingFloorPlan(factoryName, equipmentBays)
      expect(floor.source, `${factoryName} 는 실형상 배치라야 견줄 수 있다`).toBe('yard-fixture')
      const viewer = new Map(
        floor.bays.map((bay) => [bay.bay, viewerScreenY(bay.center[0], bay.center[1])])
      )

      const pairs = verticalPairs(plan).filter(([a, b]) => viewer.has(a) && viewer.has(b))
      if (bays.length > 1) expect(pairs.length, '견줄 짝이 있어야 한다').toBeGreaterThan(0)
      const flipped = pairs.filter(
        ([a, b]) =>
          Math.sign(plan.get(a)!.y - plan.get(b)!.y) !== Math.sign(viewer.get(a)! - viewer.get(b)!)
      )
      expect(flipped, `${factoryName} — 도면과 가동 뷰의 위아래가 어긋난 짝`).toEqual([])
    }
  )
})
