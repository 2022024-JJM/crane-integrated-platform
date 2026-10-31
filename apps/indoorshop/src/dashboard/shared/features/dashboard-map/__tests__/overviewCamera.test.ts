import { describe, expect, it } from 'vitest'
import { factoryBounds, loadYardParcels } from '../../../entities/yard-parcels'

import {
  allFactoriesBounds,
  bayCameraBounds,
  factoryCameraBounds,
  factoryCameraBoundsOf,
  FACTORY_CAMERA_MAX_RATIO,
  overviewCameraBounds,
  overviewBoundsAvoidingCards,
  overviewBoundsCentered,
  factoryOutlinePoints,
} from '../lib/overviewCamera'
import { fitView, project, screenToWorld } from '../../yard-map/lib/projection'

/* 공장 한 채 — 위도·경도 각 0.01도. 베이는 그 안의 조각이다 */
const factory = { minLat: 34.87, maxLat: 34.88, minLon: 128.7, maxLon: 128.71 }

describe('bayCameraBounds — 베이 카메라는 공장 범위의 일정 비율 아래로 좁히지 않는다', () => {
  it('작은 베이는 최소 비율까지 넓혀 담는다 (배율 상한)', () => {
    const bay = { minLat: 34.8745, maxLat: 34.8755, minLon: 128.7045, maxLon: 128.7055 }
    const framed = bayCameraBounds(bay, factory, 0.5)
    expect(framed.maxLat - framed.minLat).toBeCloseTo(0.005, 10)
    expect(framed.maxLon - framed.minLon).toBeCloseTo(0.005, 10)
  })

  it('넓힐 때도 베이는 가운데 그대로다 — 카메라가 옆으로 미끄러지지 않는다', () => {
    const bay = { minLat: 34.8745, maxLat: 34.8755, minLon: 128.7045, maxLon: 128.7055 }
    const framed = bayCameraBounds(bay, factory, 0.5)
    expect((framed.minLat + framed.maxLat) / 2).toBeCloseTo(34.875, 10)
    expect((framed.minLon + framed.maxLon) / 2).toBeCloseTo(128.705, 10)
  })

  it('이미 최소 비율보다 큰 베이는 그대로 둔다 — 없는 여백을 만들지 않는다', () => {
    const bay = { minLat: 34.871, maxLat: 34.879, minLon: 128.7045, maxLon: 128.7055 }
    const framed = bayCameraBounds(bay, factory, 0.5)
    expect(framed.minLat).toBeCloseTo(34.871, 10)
    expect(framed.maxLat).toBeCloseTo(34.879, 10)
    /* 짧은 축만 넓어진다 — 축마다 따로 잰다 */
    expect(framed.maxLon - framed.minLon).toBeCloseTo(0.005, 10)
  })
})

/* 야드 군집 — 위도 0.018도(≈2km), 경도 0.03도. 실제 fixture 의 비율과 같은 자리 */
const cluster = { minLat: 34.8625, maxLat: 34.8805, minLon: 128.6913, maxLon: 128.7213 }

describe('factoryCameraBounds — 공장 카메라는 군집 범위의 일정 비율 위로 넓히지 않는다', () => {
  it('긴 공장(1DOCK 꼴)은 최대 비율까지 좁혀 담는다 (배율 하한)', () => {
    /* 위도로만 군집의 34% 를 차지하는 띠 — 경도는 이미 비율 아래다 */
    const long = { minLat: 34.8685, maxLat: 34.8745, minLon: 128.6913, maxLon: 128.6951 }
    const framed = factoryCameraBounds(long, cluster, 0.17)
    expect(framed.maxLat - framed.minLat).toBeCloseTo(0.018 * 0.17, 10)
    /* 짧은 축은 손대지 않는다 — 축마다 따로 잰다 */
    expect(framed.maxLon - framed.minLon).toBeCloseTo(0.0038, 10)
  })

  it('좁힐 때도 공장은 가운데 그대로다 — 카메라가 한쪽 끝으로 쏠리지 않는다', () => {
    const long = { minLat: 34.8685, maxLat: 34.8745, minLon: 128.6913, maxLon: 128.6951 }
    const framed = factoryCameraBounds(long, cluster, 0.17)
    expect((framed.minLat + framed.maxLat) / 2).toBeCloseTo(34.8715, 10)
    expect((framed.minLon + framed.maxLon) / 2).toBeCloseTo(128.6932, 10)
  })

  it('이미 최대 비율보다 작은 공장은 그대로 둔다 — 멀쩡한 공장을 자르지 않는다', () => {
    const small = { minLat: 34.8700, maxLat: 34.8720, minLon: 128.7000, maxLon: 128.7025 }
    const framed = factoryCameraBounds(small, cluster, 0.17)
    expect(framed.minLat).toBeCloseTo(34.87, 10)
    expect(framed.maxLat).toBeCloseTo(34.872, 10)
    expect(framed.minLon).toBeCloseTo(128.7, 10)
    expect(framed.maxLon).toBeCloseTo(128.7025, 10)
  })
})

/**
 * `factoryCameraBoundsOf` — 이름으로 고른 공장의 착지 범위를 **실제 지번 fixture** 로 잰다.
 *
 * 조립 함수라 산술은 위에서 이미 봤지만, 여기서 잡으려는 것은 산술이 아니라 **실제 공장이
 * 실제로 얼마나 다가서는가**다. 선행도장 배치가 이 조합을 쓰지 않고 지번 범위를 그대로
 * 넘겨, 1DOCK 도장공장을 눌러도 대문에서 1.3배밖에 붙지 않던 일이 있었다 — 두 화면이
 * 같은 함수를 쓰는 한 그 어긋남은 여기서 드러난다.
 */
describe('factoryCameraBoundsOf — 실제 야드에서 어느 공장을 눌러도 비슷하게 다가선다', () => {
  it('긴 1DOCK 도장공장도 대문 대비 확실히 좁혀 담는다', async () => {
    const parcels = await loadYardParcels()
    const cluster = allFactoriesBounds(parcels)!
    const framed = factoryCameraBoundsOf(parcels, '1DOCK 도장공장')!

    /* 대문의 긴 축 대비 — 조이기 전에는 위도로만 군집의 3분의 1을 차지했다 */
    const latRatio = (framed.maxLat - framed.minLat) / (cluster.maxLat - cluster.minLat)
    const lonRatio = (framed.maxLon - framed.minLon) / (cluster.maxLon - cluster.minLon)
    expect(latRatio).toBeLessThanOrEqual(FACTORY_CAMERA_MAX_RATIO + 1e-9)
    expect(lonRatio).toBeLessThanOrEqual(FACTORY_CAMERA_MAX_RATIO + 1e-9)
  })

  it('공장은 어느 것이든 가운데 그대로 — 조여도 카메라가 옆으로 미끄러지지 않는다', async () => {
    const parcels = await loadYardParcels()
    for (const name of ['1DOCK 도장공장', '2DOCK 도장공장', 'GPS']) {
      const lots = factoryBounds(parcels, name)!
      const framed = factoryCameraBoundsOf(parcels, name)!
      expect((framed.minLat + framed.maxLat) / 2).toBeCloseTo((lots.minLat + lots.maxLat) / 2, 10)
      expect((framed.minLon + framed.maxLon) / 2).toBeCloseTo((lots.minLon + lots.maxLon) / 2, 10)
    }
  })

  it('지도에 없는 공장이면 null — 없는 자리로 날아가지 않는다', async () => {
    const parcels = await loadYardParcels()
    expect(factoryCameraBoundsOf(parcels, '없는 공장')).toBeNull()
  })
})

describe('overviewCameraBounds — 돌려 본 화면에서도 모든 공장이 한 화면에 든다', () => {
  it('돌리지 않고 카드 몫도 없으면 공장 군집 범위와 같다', async () => {
    const parcels = await loadYardParcels()
    const cluster = allFactoriesBounds(parcels)!
    const b = overviewCameraBounds(parcels, 0, 0)!
    expect(b.minLat).toBeCloseTo(cluster.minLat, 6)
    expect(b.maxLat).toBeCloseTo(cluster.maxLat, 6)
    expect(b.minLon).toBeCloseTo(cluster.minLon, 6)
    expect(b.maxLon).toBeCloseTo(cluster.maxLon, 6)
  })

  it('-10° 로 돌려 맞추면 모든 공장 꼭짓점이 화면 안, 왼쪽 카드 몫(약 4분의 1)에는 들지 않는다', async () => {
    const parcels = await loadYardParcels()
    const viewport = { width: 1150, height: 820 }
    const bounds = overviewCameraBounds(parcels, -10)!
    const view = fitView(bounds, viewport, 0.03, { pitch: 0, bearing: -10 })
    for (const lot of parcels.lots) {
      if (lot.factory == null) continue
      for (const p of lot.polygon) {
        const { sx, sy } = project(view, viewport, p.lat, p.lon)
        expect(sx).toBeGreaterThanOrEqual(viewport.width * 0.2)
        expect(sx).toBeLessThanOrEqual(viewport.width)
        expect(sy).toBeGreaterThanOrEqual(0)
        expect(sy).toBeLessThanOrEqual(viewport.height)
      }
    }
  })
})

describe('overviewBoundsAvoidingCards — 카드를 피해 최대로 확대한 대문', () => {
  it('맞춘 카메라에서 모든 공장 외곽이 화면 안이고 양쪽 카드 밑에 들지 않는다', async () => {
    const parcels = await loadYardParcels()
    const viewport = { width: 1392, height: 816 }
    const obstacles = [
      { x: 0, y: 48, width: 304, height: 240 },
      { x: 1240, y: 0, width: 152, height: 48 },
    ]
    const camera = { bearing: -5, pitch: 44 }
    const points = factoryOutlinePoints(parcels)
    const bounds = overviewBoundsAvoidingCards(points, viewport, obstacles, camera, { project, screenToWorld })!
    expect(bounds).not.toBeNull()
    const view = fitView(bounds, viewport, 0, camera)
    for (const p of points) {
      const { sx, sy } = project(view, viewport, p.lat, p.lon)
      expect(sx).toBeGreaterThanOrEqual(0)
      expect(sx).toBeLessThanOrEqual(viewport.width)
      expect(sy).toBeGreaterThanOrEqual(0)
      expect(sy).toBeLessThanOrEqual(viewport.height)
      for (const r of obstacles) {
        const inside = sx > r.x && sx < r.x + r.width && sy > r.y && sy < r.y + r.height
        expect(inside).toBe(false)
      }
    }
  })

  it('카드가 없을 때보다 카드가 있을 때 덜 확대한다(가려지지 않을 만큼만)', async () => {
    const parcels = await loadYardParcels()
    const viewport = { width: 1392, height: 816 }
    const camera = { bearing: -5, pitch: 44 }
    const points = factoryOutlinePoints(parcels)
    const proj = { project, screenToWorld }
    const free = fitView(overviewBoundsAvoidingCards(points, viewport, [], camera, proj)!, viewport, 0, camera)
    const boxed = fitView(
      overviewBoundsAvoidingCards(points, viewport, [{ x: 0, y: 0, width: 500, height: 816 }], camera, proj)!,
      viewport,
      0,
      camera
    )
    expect(boxed.scale).toBeLessThan(free.scale)
  })

  it('배율을 고정하면 그 배율 그대로 선다 — 중심만 카드를 피해 잡는다', async () => {
    const parcels = await loadYardParcels()
    const viewport = { width: 1384, height: 804 }
    const camera = { bearing: -30, pitch: 44 }
    const bounds = overviewBoundsAvoidingCards(
      factoryOutlinePoints(parcels),
      viewport,
      [{ x: 0, y: 48, width: 304, height: 240 }],
      camera,
      { project, screenToWorld },
      12,
      30_000
    )!
    expect(fitView(bounds, viewport, 0, camera).scale).toBeCloseTo(30_000, 0)
  })
})

describe('overviewBoundsCentered — 공장 전체가 다 보이고 한가운데에 서는 전경', () => {
  it('모든 공장 외곽이 여백 안에 들고, 그 묶음의 가운데가 화면 가운데다', async () => {
    const parcels = await loadYardParcels()
    const viewport = { width: 1544, height: 854 }
    const camera = { bearing: -48, pitch: 50 }
    const margin = { x: 32, y: 72 }
    const points = factoryOutlinePoints(parcels)
    const bounds = overviewBoundsCentered(points, viewport, camera, { project, screenToWorld }, margin)!
    expect(bounds).not.toBeNull()
    const view = fitView(bounds, viewport, 0, camera)
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const p of points) {
      const { sx, sy } = project(view, viewport, p.lat, p.lon)
      x0 = Math.min(x0, sx)
      x1 = Math.max(x1, sx)
      y0 = Math.min(y0, sy)
      y1 = Math.max(y1, sy)
    }
    /* 다 보인다 — 여백 안(반올림 1px 허용) */
    expect(x0).toBeGreaterThanOrEqual(margin.x - 1)
    expect(x1).toBeLessThanOrEqual(viewport.width - margin.x + 1)
    expect(y0).toBeGreaterThanOrEqual(margin.y - 1)
    expect(y1).toBeLessThanOrEqual(viewport.height - margin.y + 1)
    /* 한가운데 — 묶음 상자의 가운데가 화면 가운데(2px 안) */
    expect(Math.abs((x0 + x1) / 2 - viewport.width / 2)).toBeLessThan(2)
    expect(Math.abs((y0 + y1) / 2 - viewport.height / 2)).toBeLessThan(2)
    /* 꼭 맞는다 — 한 축은 여백에 닿는다(쓸데없이 물러나지 않는다) */
    const fillX = (x1 - x0) / (viewport.width - margin.x * 2)
    const fillY = (y1 - y0) / (viewport.height - margin.y * 2)
    expect(Math.max(fillX, fillY)).toBeGreaterThan(0.98)
  })
})
