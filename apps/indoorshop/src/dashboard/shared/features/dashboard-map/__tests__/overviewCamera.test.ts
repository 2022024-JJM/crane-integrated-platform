import { describe, expect, it } from 'vitest'
import { factoryBounds, loadYardParcels } from '../../../entities/yard-parcels'

import {
  allFactoriesBounds,
  bayCameraBounds,
  factoryCameraBounds,
  factoryCameraBoundsOf,
  FACTORY_CAMERA_MAX_RATIO,
} from '../lib/overviewCamera'

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
