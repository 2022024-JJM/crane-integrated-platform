import { describe, expect, it } from 'vitest'
import {
  adjacentLotGroups,
  alignedAxes,
  axisOf,
  bayRoofOf,
  centerOfPoints,
  outlineOf,
  ridgeAxisOf,
  ringExtentAround,
  straightenBayFootprints,
  straightenToAxis,
  unmappedFactoryLots,
  type OrientedExtent,
} from '../bayGable'
import { polygonArea } from '../footprint'
import { LON_SQUEEZE } from '../projection'
import { BAY_ROOF } from '../relief'
import type { LatLon } from '../../model/types'

/**
 * 베이 하나에 씌우는 박공 지붕과, 그 위의 지번 구획.
 *
 * 지켜야 하는 것은 넷이다 —
 *  1. **발자국은 소속 지번을 합친 그대로.** 사각형으로 펴면 폭이 다른 칸이 있는 베이에서
 *     벽이 지면의 2D 지번선 밖으로 넘어간다(그 어긋남이 화면에서 오프셋으로 보인다).
 *  2. **지붕은 스팬을 따라 한 장으로 이어진다.** 칸마다 끊으면 베이가 여러 채로 쪼개진다.
 *  3. **지번 경계는 구획으로 남는다.** 구획이 없으면 베이 안이 나뉘어 보이지 않는다.
 *  4. **높이는 `ridgeRatio` 하나로 정해진다.** 벽과 지붕이 같은 규칙을 쓰므로 짧은 끝의
 *     박공 삼각형이 저절로 맞물린다 — 어긋나면 지붕과 벽 사이가 벌어진다.
 */

/** 베이 축(경도)을 따라 토막 낸 지번들 — 실제 자료의 모양(폭은 같고 길이만 다름) */
function strip(width: number, cuts: number[]): { lot: string; polygon: LatLon[] }[] {
  const out: { lot: string; polygon: LatLon[] }[] = []
  let x = 0
  cuts.forEach((length, i) => {
    out.push({
      lot: `L${i}`,
      polygon: [
        { lat: 0, lon: x },
        { lat: 0, lon: x + length },
        { lat: width, lon: x + length },
        { lat: width, lon: x },
      ],
    })
    x += length
  })
  return out
}

describe('outlineOf', () => {
  it('맞닿은 지번들의 바깥 경계만 남긴다 — 안쪽 공유 변은 지운다', () => {
    const ring = outlineOf(strip(0.0003, [0.001, 0.0008]).map((l) => l.polygon))!
    /* 이음매의 일직선 꼭짓점은 남는다 — 모양은 같다 */
    expect(polygonArea(ring)).toBeCloseTo(polygonArea([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.0018 },
      { lat: 0.0003, lon: 0.0018 },
      { lat: 0.0003, lon: 0 },
    ]), 12)
  })

  it('떨어져 있어 고리가 닫히지 않으면 null — 부르는 쪽이 볼록 껍질로 갈음한다', () => {
    const far = [
      [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }, { lat: 1, lon: 0 }],
      [{ lat: 0, lon: 5 }, { lat: 0, lon: 6 }, { lat: 1, lon: 6 }, { lat: 1, lon: 5 }],
    ]
    expect(outlineOf(far)).toBeNull()
  })
})

describe('bayRoofOf', () => {
  it('발자국은 지번을 합친 그대로다 — 3D 벽이 지면의 2D 지번선과 겹치도록', () => {
    const lots = strip(0.0003, [0.001, 0.0008])
    const roof = bayRoofOf(lots)!
    const merged = lots.reduce((sum, l) => sum + polygonArea(l.polygon), 0)
    expect(polygonArea(roof.outline)).toBeCloseTo(merged, 12)
  })

  it('폭이 다른 칸이 있어도 발자국이 부풀지 않는다 — 사각형으로 펴면 선 밖으로 넘어간다', () => {
    /* NPS 3BAY 처럼 한 칸만 좁은 베이 */
    const lots = [
      {
        lot: 'narrow',
        polygon: [
          { lat: 0, lon: 0 },
          { lat: 0, lon: 0.001 },
          { lat: 0.00015, lon: 0.001 },
          { lat: 0.00015, lon: 0 },
        ],
      },
      {
        lot: 'wide',
        polygon: [
          { lat: 0, lon: 0.001 },
          { lat: 0, lon: 0.002 },
          { lat: 0.0004, lon: 0.002 },
          { lat: 0.0004, lon: 0.001 },
        ],
      },
    ]
    const roof = bayRoofOf(lots)!
    const merged = lots.reduce((sum, l) => sum + polygonArea(l.polygon), 0)
    expect(polygonArea(roof.outline)).toBeCloseTo(merged, 12)
    /* 최소 넓이 사각형(0.002 × 0.0004)이었다면 훨씬 컸을 것 */
    expect(polygonArea(roof.outline)).toBeLessThan(0.002 * 0.0004 * 0.9)
  })

  it('용마루는 베이 길이를 끊기지 않고 지난다 — 칸 수와 무관하다', () => {
    const one = bayRoofOf(strip(0.0003, [0.0018]))!
    const three = bayRoofOf(strip(0.0003, [0.001, 0.0005, 0.0003]))!
    const len = (r: readonly [LatLon, LatLon]) => Math.hypot(r[1].lon - r[0].lon, r[1].lat - r[0].lat)
    expect(len(three.ridge)).toBeCloseTo(len(one.ridge), 9)
    expect(len(three.ridge)).toBeCloseTo(0.0018, 9)
  })

  it('베이 축을 주면 그것을 따른다 — 짧은 베이도 이웃과 같은 방향으로 눕는다', () => {
    /* 길이(경도)보다 폭(위도)이 큰 베이. 제 긴 축이라면 용마루가 90° 돌아갔을 것 */
    const stub = strip(0.0005, [0.0002])
    const bayAxis = axisOf([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.003 },
      { lat: 0.0005, lon: 0.003 },
      { lat: 0.0005, lon: 0 },
    ])!
    const roof = bayRoofOf(stub, bayAxis)!
    const [a, b] = roof.ridge
    expect(Math.abs(b.lon - a.lon)).toBeGreaterThan(Math.abs(b.lat - a.lat))
  })

  it('지번마다 지붕 구획이 남는다 — 이어진 지붕 위에 선을 그을 자리', () => {
    const roof = bayRoofOf(strip(0.0003, [0.001, 0.0005, 0.0003]))!
    expect(new Set(roof.patches.map((p) => p.lot)).size).toBe(3)
    /* 용마루로 갈라 지번마다 두 쪽 */
    expect(roof.patches).toHaveLength(6)
    /* 구획을 다 합치면 발자국이 된다 — 지붕에 구멍이나 겹침이 없다 */
    const total = roof.patches.reduce((sum, p) => sum + polygonArea(p.polygon), 0)
    expect(total).toBeCloseTo(polygonArea(roof.outline), 12)
  })

  it('높이 규칙: 용마루 위는 1, 처마는 0 — 벽과 지붕이 같은 값을 쓴다', () => {
    const roof = bayRoofOf(strip(0.0004, [0.002]))!
    for (const end of roof.ridge) expect(roof.ridgeRatio(end)).toBeCloseTo(1, 9)
    for (const p of roof.outline) expect(roof.ridgeRatio(p)).toBeCloseTo(0, 9)
  })

  it('용마루 올림은 베이 폭을 따르되 상·하한 안에 머문다', () => {
    const mid = bayRoofOf(strip(0.0003, [0.004]))!
    expect(mid.rise).toBeGreaterThan(BAY_ROOF.minRise)
    expect(mid.rise).toBeLessThan(BAY_ROOF.maxRise)
    expect(bayRoofOf(strip(0.00002, [0.004]))!.rise).toBe(BAY_ROOF.minRise)
    expect(bayRoofOf(strip(0.002, [0.004]))!.rise).toBe(BAY_ROOF.maxRise)
  })

  it('그릴 지번이 없으면 지붕도 없다 — 부르는 쪽이 평지붕으로 돌아간다', () => {
    expect(bayRoofOf([])).toBeNull()
    expect(bayRoofOf([{ lot: 'x', polygon: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }] }])).toBeNull()
  })
})

describe('상수', () => {
  it('베이 색조는 이웃끼리 갈리되 공장 하나는 한 색으로 남는다', () => {
    const tints = BAY_ROOF.bayTints
    expect(tints.length).toBeGreaterThanOrEqual(3)
    /* 이웃한 1·2베이가 구분될 만큼은 다르다 */
    for (let i = 0; i < tints.length; i++) {
      const next = tints[(i + 1) % tints.length]
      expect(Math.abs(tints[i] - next)).toBeGreaterThan(0.04)
    }
    /* 그러나 폭은 좁다 — 넓으면 같은 공장 안에서 서로 다른 색으로 보인다 */
    expect(Math.max(...tints) - Math.min(...tints)).toBeLessThanOrEqual(0.14)
  })
})

describe('centerOfPoints', () => {
  it('꼭짓점 평균을 낸다', () => {
    expect(centerOfPoints([
      { lat: 0, lon: 0 },
      { lat: 0, lon: 4 },
      { lat: 2, lon: 4 },
      { lat: 2, lon: 0 },
    ])).toEqual({ lat: 1, lon: 2 })
  })
})

describe('alignedAxes — 한 공장 안 베이들의 용마루 방향 맞추기', () => {
  /** 각도(도)·길이로 최소 넓이 사각형 정보를 짓는다 */
  const extent = (deg: number, long: number, short: number): OrientedExtent => ({
    axis: { x: Math.cos((deg * Math.PI) / 180), y: Math.sin((deg * Math.PI) / 180) },
    long,
    short,
  })
  /** 베이 하나 — 축과 중심. 중심은 위도 0 근처의 작은 값이라 평면처럼 다뤄도 된다 */
  const bay = (e: OrientedExtent | null, lat = 0, lon = 0) => ({ extent: e, center: { lat, lon } })
  /** 축 → [0,180) 각도(도). 용마루에는 앞뒤가 없으므로 180° 는 같은 방향이다 */
  const degOf = (axis: { x: number; y: number } | null) =>
    axis === null ? null : ((((Math.atan2(axis.y, axis.x) * 180) / Math.PI) % 180) + 180) % 180
  /** 나란히 늘어선 베이들의 중심 — i 번째는 90° 방향(북쪽)으로 한 칸씩 밀린다 */
  const stackedNorth = (i: number) => ({ lat: i * 0.001, lon: 0 })

  it('몇 도씩 흔들리는 나란한 베이들은 **정확히 같은** 방향으로 모인다', () => {
    const aligned = alignedAxes([
      { extent: extent(30, 300, 40), center: stackedNorth(0) },
      { extent: extent(34, 300, 40), center: stackedNorth(1) },
      { extent: extent(27, 300, 40), center: stackedNorth(2) },
    ])
    expect(degOf(aligned[0])).toBeCloseTo(degOf(aligned[1])!, 9)
    expect(degOf(aligned[1])).toBeCloseTo(degOf(aligned[2])!, 9)
    /* 무리의 가중 평균 언저리 */
    expect(degOf(aligned[0])!).toBeGreaterThan(28)
    expect(degOf(aligned[0])!).toBeLessThan(33)
  })

  it('정말 다른 방향의 별동은 제 무리를 갖는다 — 공장 하나에 축 하나를 강제하지 않는다', () => {
    const aligned = alignedAxes([
      { extent: extent(10, 300, 40), center: stackedNorth(0) },
      { extent: extent(12, 300, 40), center: stackedNorth(1) },
      { extent: extent(85, 300, 40), center: { lat: 0, lon: 0.05 } },
    ])
    expect(degOf(aligned[0])).toBeCloseTo(degOf(aligned[1])!, 9)
    expect(Math.abs(degOf(aligned[2])! - degOf(aligned[0])!)).toBeGreaterThan(60)
  })

  it('비뚤어진 발자국 한둘이 무리의 방향을 끌고 가지 않는다', () => {
    /* 셋은 30°, 하나는 11° 어긋난 41° — 평균이 아니라 30° 에 머물러야 한다 */
    const aligned = alignedAxes([
      { extent: extent(30, 300, 40), center: stackedNorth(0) },
      { extent: extent(30, 300, 40), center: stackedNorth(1) },
      { extent: extent(30, 300, 40), center: stackedNorth(2) },
      { extent: extent(41, 200, 40), center: stackedNorth(3) },
    ])
    for (const axis of aligned) expect(degOf(axis)).toBeCloseTo(30, 6)
  })

  it('반듯한 칸은 제 축이 90° 뒤집혀 있어도 **이웃이 늘어선 방향에 직각**으로 선다', () => {
    /*
     * 1DOCK 도장공장의 낱개 셀이 이 모양이다: 30×28 이라 긴 축이 이웃과 직각으로 잡히지만,
     * 셋이 북쪽으로 나란히 붙어 있으므로 용마루는 동서(0°)여야 한다.
     */
    const aligned = alignedAxes([
      { extent: extent(0, 300, 40), center: { lat: -0.002, lon: 0 } },
      { extent: extent(90, 31, 28), center: stackedNorth(0) },
      { extent: extent(90, 31, 28), center: stackedNorth(1) },
      { extent: extent(0, 31, 28), center: stackedNorth(2) },
    ])
    for (const axis of aligned) expect(degOf(axis)).toBeCloseTo(0, 6)
  })

  it('길쭉한 베이는 이웃이 아니라 제 축을 따른다 — 끝끼리 이어 붙은 배치에 흔들리지 않는다', () => {
    /* 두 번째는 길쭉하고(비 5.0) 제 축이 90°: 이웃 방향(북)과 무관하게 90° 무리로 간다 */
    const aligned = alignedAxes([
      { extent: extent(0, 300, 40), center: { lat: -0.01, lon: 0 } },
      { extent: extent(90, 200, 40), center: stackedNorth(0) },
    ])
    expect(degOf(aligned[0])).toBeCloseTo(0, 6)
    expect(degOf(aligned[1])).toBeCloseTo(90, 6)
  })

  it('축을 못 구한 자리는 null 그대로 — 없는 방향을 지어내지 않는다', () => {
    const aligned = alignedAxes([bay(extent(15, 300, 40)), bay(null, 0.001)])
    expect(aligned[1]).toBeNull()
  })

  it('믿을 만한 축이 하나도 없으면 각자 제 축을 그대로 쓴다', () => {
    const aligned = alignedAxes([bay(extent(15, 51, 50)), bay(extent(80, 51, 50), 0.001)])
    expect(degOf(aligned[0])).toBeCloseTo(15, 6)
    expect(degOf(aligned[1])).toBeCloseTo(80, 6)
  })
})

describe('straightenToAxis — 격자에서 돌아간 발자국을 제자리로 세우기', () => {
  /** 중심 (0,0) 둘레의 직사각형을 deg 만큼 돌려 놓는다. 크기는 도(°) 단위 */
  const rect = (deg: number, halfLong: number, halfShort: number): LatLon[] => {
    const t = (deg * Math.PI) / 180
    const c = Math.cos(t)
    const s = Math.sin(t)
    return [
      [-halfLong, -halfShort],
      [halfLong, -halfShort],
      [halfLong, halfShort],
      [-halfLong, halfShort],
    ].map(([u, v]) => ({ lat: u * s + v * c, lon: (u * c - v * s) / LON_SQUEEZE }))
  }
  const axisAt = (deg: number) => ({
    x: Math.cos((deg * Math.PI) / 180),
    y: Math.sin((deg * Math.PI) / 180),
  })
  const degOf = (polygon: readonly LatLon[]) => {
    const axis = axisOf(polygon)!
    return ((((Math.atan2(axis.y, axis.x) * 180) / Math.PI) % 180) + 180) % 180
  }

  it('돌아간 발자국을 목표 축으로 세운다', () => {
    const turned = straightenToAxis([rect(129, 0.0002, 0.00012)], axisAt(140.8))
    expect(turned).not.toBeNull()
    expect(degOf(turned![0])).toBeCloseTo(140.8, 4)
  })

  it('이미 나란하면 null — 멀쩡한 좌표를 사본으로 갈아치우지 않는다', () => {
    expect(straightenToAxis([rect(140.8, 0.0002, 0.00012)], axisAt(140.8))).toBeNull()
  })

  it('축이 90° 뒤집혀 있어도 건물을 자빠뜨리지 않는다 — 회전은 ±45° 안에서 고른다', () => {
    /* 반듯한 칸은 이웃을 보고 축을 직각으로 받는다(alignedAxes). 그때 발자국은 그대로여야 한다 */
    expect(straightenToAxis([rect(50.9, 0.00016, 0.00014)], axisAt(140.8))).toBeNull()
  })

  it('중심과 크기는 그대로 둔다 — 돌리기만 한다', () => {
    const before = rect(129, 0.0002, 0.00012)
    const turned = straightenToAxis([before], axisAt(140.8))!
    const mean = (poly: readonly LatLon[], key: 'lat' | 'lon') =>
      poly.reduce((s, p) => s + p[key], 0) / poly.length
    expect(mean(turned[0], 'lat')).toBeCloseTo(mean(before, 'lat'), 9)
    expect(mean(turned[0], 'lon')).toBeCloseTo(mean(before, 'lon'), 9)
    expect(polygonArea(turned[0])).toBeCloseTo(polygonArea(before), 12)
  })

  it('한 베이의 지번 여러 장은 **함께** 돈다 — 서로의 이음매가 벌어지지 않는다', () => {
    const left = rect(129, 0.0001, 0.00012)
    const right = left.map((p) => ({ lat: p.lat, lon: p.lon + 0.0002 }))
    const turned = straightenToAxis([left, right], axisAt(140.8))!
    /* 돌기 전 맞닿아 있던 두 꼭짓점은 돈 뒤에도 같은 거리다.
       거리는 회전이 일어나는 **평면**(경도를 누른 좌표)에서 잰다 — 위경도 그대로 재면
       경도 1도가 위도 1도보다 짧아서 돌리기만 해도 값이 달라진다 */
    const gap = (a: LatLon, b: LatLon) =>
      Math.hypot(a.lat - b.lat, (a.lon - b.lon) * LON_SQUEEZE)
    const gapBefore = gap(right[0], left[1])
    const gapAfter = gap(turned[1][0], turned[0][1])
    expect(gapAfter).toBeCloseTo(gapBefore, 12)
  })

  it('축이 없으면 손대지 않는다', () => {
    expect(straightenToAxis([rect(129, 0.0002, 0.00012)], null)).toBeNull()
  })
})

describe('ringExtentAround — 베이가 들어앉은 OSM 건물의 실측 치수', () => {
  /** deg 방향의 직사각형 링 — OSM 링은 [경도, 위도] 짝이다 */
  const ringAt = (deg: number, halfLong: number, halfShort: number): [number, number][] => {
    const t = (deg * Math.PI) / 180
    const c = Math.cos(t)
    const s = Math.sin(t)
    return [
      [-halfLong, -halfShort],
      [halfLong, -halfShort],
      [halfLong, halfShort],
      [-halfLong, halfShort],
    ].map(([u, v]) => [(u * c - v * s) / LON_SQUEEZE, u * s + v * c] as [number, number])
  }
  const degOf = (axis: { x: number; y: number } | null) =>
    axis === null ? null : ((((Math.atan2(axis.y, axis.x) * 180) / Math.PI) % 180) + 180) % 180

  it('점들을 모두 품는 링의 긴 축과 두 변을 돌려준다', () => {
    const extent = ringExtentAround([{ lat: 0, lon: 0 }], [ringAt(129.4, 0.0004, 0.0002)])
    expect(degOf(extent?.axis ?? null)).toBeCloseTo(129.4, 4)
    expect((extent?.long ?? 0) / (extent?.short ?? 1)).toBeCloseTo(2, 5)
  })

  it('일부만 품으면(베이가 건물에 반쯤 걸치면) 그 건물은 잣대가 아니다', () => {
    const axis = ringExtentAround(
      [{ lat: 0, lon: 0 }, { lat: 0.01, lon: 0.01 }],
      [ringAt(129.4, 0.0004, 0.0002)]
    )
    expect(axis).toBeNull()
  })

  it('품는 링이 없으면 null — 격자 정렬이 잣대로 남는다', () => {
    expect(ringExtentAround([{ lat: 0.1, lon: 0.1 }], [ringAt(30, 0.0004, 0.0002)])).toBeNull()
    expect(ringExtentAround([], [ringAt(30, 0.0004, 0.0002)])).toBeNull()
  })
})

describe('straightenToAxis — 눕히기 (foldQuarter=false)', () => {
  const rect = (deg: number, halfLong: number, halfShort: number): LatLon[] => {
    const t = (deg * Math.PI) / 180
    const c = Math.cos(t)
    const s = Math.sin(t)
    return [
      [-halfLong, -halfShort],
      [halfLong, -halfShort],
      [halfLong, halfShort],
      [-halfLong, halfShort],
    ].map(([u, v]) => ({ lat: u * s + v * c, lon: (u * c - v * s) / LON_SQUEEZE }))
  }
  const axisAt = (deg: number) => ({
    x: Math.cos((deg * Math.PI) / 180),
    y: Math.sin((deg * Math.PI) / 180),
  })
  const degOf = (polygon: readonly LatLon[]) => {
    const axis = axisOf(polygon)!
    return ((((Math.atan2(axis.y, axis.x) * 180) / Math.PI) % 180) + 180) % 180
  }

  it('긴 축을 목표 축에 그대로 맞춘다 — 90° 가까이도 돈다', () => {
    /* 1DOCK A5 의 모양: 셀의 긴 축(129.4°)을 건물의 긴 축(51.3°)에 눕힌다 */
    const turned = straightenToAxis([rect(129.4, 0.00016, 0.0001)], axisAt(51.3), false)
    expect(turned).not.toBeNull()
    expect(degOf(turned![0])).toBeCloseTo(51.3, 4)
  })

  it('접기(기본값)와 다르다 — 같은 입력을 접으면 90° 덜 돈다', () => {
    const folded = straightenToAxis([rect(129.4, 0.00016, 0.0001)], axisAt(51.3), true)
    expect(degOf(folded![0])).toBeCloseTo(141.3, 4)
  })
})

describe('straightenBayFootprints — 건물 실측이 있는 베이', () => {
  const rect = (deg: number, cx: number, cy: number, halfLong: number, halfShort: number): LatLon[] => {
    const t = (deg * Math.PI) / 180
    const c = Math.cos(t)
    const s = Math.sin(t)
    return [
      [-halfLong, -halfShort],
      [halfLong, -halfShort],
      [halfLong, halfShort],
      [-halfLong, halfShort],
    ].map(([u, v]) => ({ lat: cy + (u * s + v * c), lon: cx + (u * c - v * s) / LON_SQUEEZE }))
  }
  const axisAt = (deg: number) => ({
    x: Math.cos((deg * Math.PI) / 180),
    y: Math.sin((deg * Math.PI) / 180),
  })
  const degOf = (polygon: readonly LatLon[]) => {
    const axis = axisOf(polygon)!
    return ((((Math.atan2(axis.y, axis.x) * 180) / Math.PI) % 180) + 180) % 180
  }

  it('셀이 건물에 세로로 안 들어가면(긴 변 > 건물 짧은 변) 눕혀 맞춘다', () => {
    /* 1DOCK A5 축소판 — 셀 32.5×20.6 이 깊이 22.6 건물에 든 경우 */
    const lots = [{ lot: 'A5', polygon: rect(129.4, 0, 0, 0.000146, 0.0000926) }]
    const bays = [{
      factory: 'F',
      lotCodes: ['A5'],
      building: { axis: axisAt(51.3), long: 0.000577, short: 0.000203 },
    }]
    const out = straightenBayFootprints(lots, bays)
    expect(degOf(out.get('A5')!)).toBeCloseTo(51.3, 4)
  })

  it('셀이 세로로 들어가면 접기 그대로 — 눕힐 이유가 없다', () => {
    const lots = [{ lot: 'B1', polygon: rect(129.4, 0, 0, 0.000146, 0.0000926) }]
    const bays = [{
      factory: 'F',
      lotCodes: ['B1'],
      /* 건물 짧은 변이 셀 긴 변보다 넉넉히 크다 */
      building: { axis: axisAt(51.3), long: 0.001, short: 0.0005 },
    }]
    const out = straightenBayFootprints(lots, bays)
    expect(degOf(out.get('B1')!)).toBeCloseTo(141.3, 4)
  })

  it('건물이 베이보다 훨씬 깊으면 눕히지 않는다 — 다중 스팬 동의 긴 축은 용마루가 아니다', () => {
    /*
     * GPS 4BAY 축소판 — 78.5×32.2m 스팬이 96.8×65.0m 건물에 **셋 나란히** 든다.
     * 베이 긴 변(78.5)이 건물 깊이(65.0)보다 길어 옛 규칙은 눕혔지만, 건물 깊이는
     * 베이 폭의 2배라 그 건물은 스팬 여러 채가 든 다중 스팬 동이다 — 눕히면 이웃
     * 스팬을 가로질러 자빠진다. 격자(제 축)를 그대로 두어야 한다.
     */
    const lots = [{ lot: 'G4', polygon: rect(140.7, 0, 0, 0.000353, 0.000145) }]
    const bays = [{
      factory: 'F',
      lotCodes: ['G4'],
      building: { axis: axisAt(49.4), long: 0.000869, short: 0.000584 },
    }]
    const out = straightenBayFootprints(lots, bays)
    /* 눕혔다면 49.4°. 접기만 하므로 건물 축의 직각 쪽(139.4°)으로 살짝 다듬어질 뿐이다 */
    expect(degOf(out.get('G4') ?? lots[0].polygon)).toBeCloseTo(139.4, 1)
  })
})

describe('adjacentLotGroups — 도로로 끊긴 베이를 인접 토막으로 가른다', () => {
  it('맞닿은 토막들은 한 그룹이다', () => {
    const groups = adjacentLotGroups(strip(0.0003, [0.001, 0.0008, 0.0005]).map((l) => l.polygon))
    expect(groups).toHaveLength(1)
    expect(groups[0]).toHaveLength(3)
  })

  it('SSY 2베이 — 9m 도로로 끊긴 세 토막은 세 그룹이다 (원본 `지번인접여부(3m)`=분리 3그룹)', () => {
    /* parcelsFixture 의 SY2B01·SY2B02·SY2B03 실좌표 (EPSG:5187 → WGS84) */
    const sy2 = [
      [
        { lat: 34.870118, lon: 128.707018 },
        { lat: 34.869922, lon: 128.706824 },
        { lat: 34.870536, lon: 128.70591 },
        { lat: 34.870732, lon: 128.706104 },
      ],
      [
        { lat: 34.870787, lon: 128.706022 },
        { lat: 34.870591, lon: 128.705829 },
        { lat: 34.871133, lon: 128.705021 },
        { lat: 34.871329, lon: 128.705215 },
      ],
      [
        { lat: 34.87138, lon: 128.705138 },
        { lat: 34.871185, lon: 128.704944 },
        { lat: 34.871716, lon: 128.704153 },
        { lat: 34.871912, lon: 128.704347 },
      ],
    ]
    expect(adjacentLotGroups(sy2)).toHaveLength(3)
  })

  it('꼭짓점이 멀어도 변에 닿으면 인접이다 — 폭이 다른 칸(NPS 3BAY 모양)', () => {
    /* 좁은 칸(19m격)이 넓은 칸(43m격)의 변 가운데에 붙는다 — 꼭짓점끼리는 멀다 */
    const wide: LatLon[] = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.001 },
      { lat: 0.0004, lon: 0.001 },
      { lat: 0.0004, lon: 0 },
    ]
    const narrow: LatLon[] = [
      { lat: 0.0004, lon: 0.0004 },
      { lat: 0.0004, lon: 0.0006 },
      { lat: 0.0006, lon: 0.0006 },
      { lat: 0.0006, lon: 0.0004 },
    ]
    expect(adjacentLotGroups([wide, narrow])).toHaveLength(1)
  })
})

describe('straightenBayFootprints — 도로로 끊긴 베이는 토막마다 제 몸으로 돈다', () => {
  it('한 토막이 돌아가 있어도 다른 토막은 끌려 돌지 않는다', () => {
    /* 같은 베이의 두 토막 — 긴 쪽(무리의 기준)은 격자 위에 반듯하고, 짧은 쪽만 12° 돌아가 있다 */
    const t = (12 * Math.PI) / 180
    const c = Math.cos(t)
    const s = Math.sin(t)
    const straightLot: LatLon[] = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.003 },
      { lat: 0.0003, lon: 0.003 },
      { lat: 0.0003, lon: 0 },
    ]
    const turnedLot: LatLon[] = [
      [0, 0],
      [0.0012, 0],
      [0.0012, 0.0003],
      [0, 0.0003],
    ].map(([u, v]) => ({
      lat: 0.002 + (u * s + v * c),
      lon: 0.005 + (u * c - v * s) / LON_SQUEEZE,
    }))
    const out = straightenBayFootprints(
      [
        { lot: 'A', polygon: straightLot },
        { lot: 'B', polygon: turnedLot },
      ],
      [{ factory: 'F', lotCodes: ['A', 'B'] }]
    )
    /* 반듯한 토막은 손대지 않고(담기지 않음), 돌아간 토막만 제자리로 돈다 */
    expect(out.has('A')).toBe(false)
    const fixed = out.get('B')!
    const axis = axisOf(fixed)!
    const deg = ((((Math.atan2(axis.y, axis.x) * 180) / Math.PI) % 180) + 180) % 180
    expect(Math.min(deg, 180 - deg)).toBeLessThan(0.01)
  })
})

describe('ridgeAxisOf — 용마루는 제 긴 쪽을 따른다', () => {
  const axisAt = (deg: number) => ({
    x: Math.cos((deg * Math.PI) / 180),
    y: Math.sin((deg * Math.PI) / 180),
  })
  const extent = (deg: number, long: number, short: number): OrientedExtent => ({
    axis: axisAt(deg),
    long,
    short,
  })
  const degOf = (axis: { x: number; y: number } | null) =>
    axis === null ? null : ((((Math.atan2(axis.y, axis.x) * 180) / Math.PI) % 180) + 180) % 180

  it('길쭉한 한 채는 실측 축이 90° 어긋나 있어도 제 긴 쪽을 쓴다', () => {
    /* CTS 1BAY 의 모양 — 3.8:1 로 길쭉한데 제 건물(다중 스팬 동)의 긴 축은 스팬을 가로지른다 */
    const axis = ridgeAxisOf({
      own: extent(30, 380, 100),
      measured: axisAt(120),
      aligned: axisAt(120),
    })
    expect(degOf(axis)).toBeCloseTo(30, 6)
  })

  it('격자 추정이 제 긴 쪽을 야드 격자로 끌고 가지 않는다 — 돌아앉은 건물은 돌아앉은 채로', () => {
    /*
     * 1DOCK A5·A6 처럼 건물이 야드 격자에서 11° 돌아앉은 경우. 발자국은 이미 그 건물에
     * 맞춰 서 있으므로(`straightenBayFootprints`) 제 긴 축이 곧 건물 축(41°)이고,
     * 격자 추정(30°)은 그보다 멀다 — 가까운 쪽을 받아야 건물이 제자리에 남는다.
     */
    const axis = ridgeAxisOf({
      own: extent(41, 380, 100),
      measured: axisAt(41),
      aligned: axisAt(30),
    })
    expect(degOf(axis)).toBeCloseTo(41, 6)
  })

  it('실측이 없으면 가까운 격자 추정을 받아 이웃과 **정확히** 나란해진다', () => {
    /* 제 축은 반올림으로 2° 흔들려 있다 — 무리의 축을 받아야 톱니가 안 생긴다 */
    const axis = ridgeAxisOf({ own: extent(32, 380, 100), aligned: axisAt(30) })
    expect(degOf(axis)).toBeCloseTo(30, 6)
  })

  it('반듯한 칸은 제 긴 쪽이 잡음이라 남의 잣대에 맡긴다', () => {
    /* 1.05:1 — 어느 쪽이 긴지는 원본의 반올림이 정한다. 그것을 용마루로 삼으면 이웃과 엇갈린다 */
    const axis = ridgeAxisOf({ own: extent(30, 105, 100), measured: axisAt(120) })
    expect(degOf(axis)).toBeCloseTo(120, 6)
  })

  it('반듯한 칸에서는 **이웃이 실측보다 앞선다** — 줄지어 선 칸이 지붕 한 장으로 이어지지 않게', () => {
    /*
     * 1DOCK 도장공장의 30×28 셀. 제 건물(칸 여럿이 줄지어 든 동)의 긴 축은 줄 방향(30°)
     * 이라, 그것을 용마루로 삼으면 칸마다 서야 할 지붕이 한 장으로 이어진다. 이웃 잣대는
     * 줄에 직각(120°)을 내주므로 칸마다 제 지붕이 줄을 가로질러 선다.
     */
    const axis = ridgeAxisOf({
      own: extent(120, 105, 100),
      measured: axisAt(30),
      aligned: axisAt(120),
    })
    expect(degOf(axis)).toBeCloseTo(120, 6)
  })

  it('반듯한가를 가르는 잣대가 alignedAxes 와 같다 — 1DOCK B6 이 혼자 이웃과 직각으로 서지 않게', () => {
    /*
     * B6 은 1.16 으로 "긴 쪽이 있다"는 낮은 문턱만 겨우 넘는데, 같은 줄의 B7~B12(1.03~1.12)
     * 는 못 넘어 이웃 잣대를 따랐다 — 잣대가 둘로 갈리면 그 사이에 낀 칸이 혼자 90° 돌아
     * 눕는다. 두 곳이 같은 질문을 하므로 문턱도 하나여야 한다.
     */
    const axis = ridgeAxisOf({
      own: extent(51, 116, 100),
      measured: axisAt(51),
      aligned: axisAt(141),
    })
    expect(degOf(axis)).toBeCloseTo(141, 6)
  })

  it('줄을 가로질러 길쭉한 칸은 제 긴 쪽 그대로 — 건물이 줄 방향이어도 눕지 않는다', () => {
    /* 1DOCK B1~B5 의 모양 — 1.6:1 로 줄을 가로질러 길다. 실측(줄 방향)은 90° 벌어져 버려진다 */
    const axis = ridgeAxisOf({
      own: extent(120, 164, 100),
      measured: axisAt(30),
      aligned: axisAt(120),
    })
    expect(degOf(axis)).toBeCloseTo(120, 6)
  })

  it('아무 단서가 없으면 제 축, 발자국조차 없으면 null — 없는 방향을 지어내지 않는다', () => {
    expect(degOf(ridgeAxisOf({ own: extent(30, 380, 100) }))).toBeCloseTo(30, 6)
    expect(ridgeAxisOf({ own: null })).toBeNull()
  })
})

describe('unmappedFactoryLots — 베이 매핑이 없는 공장만 세운다', () => {
  /** 지번 한 장 — (cx, cy) 둘레의 작은 사각형. 크기는 도(°) 단위 */
  const lot = (cx: number, cy: number, half = 0.0002): LatLon[] => [
    { lat: cy - half, lon: cx - half },
    { lat: cy - half, lon: cx + half },
    { lat: cy + half, lon: cx + half },
    { lat: cy + half, lon: cx - half },
  ]
  const source = (
    polygons: Record<string, LatLon[]>,
    owner: Record<string, string>,
    spanned: string[] = []
  ) => ({
    hasBays: false,
    spanned: new Set(spanned),
    ownerOf: new Map(Object.entries(owner)),
    polygonOf: new Map(Object.entries(polygons)),
  })

  it('베이 매핑이 아예 없는 공장(형강·T-BAR 절단공장)은 제 지번이 통째로 한 채가 된다', () => {
    const groups = unmappedFactoryLots(
      { name: 'F', lotCodes: ['a', 'b'] },
      source({ a: lot(0, 0), b: lot(0.0004, 0) }, { a: 'F', b: 'F' })
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].map((entry) => entry.lot)).toEqual(['a', 'b'])
  })

  it('베이 매핑이 있는 공장은 매핑 밖 지번을 세우지 않는다 — 베이가 곧 건물의 목록이다', () => {
    /*
     * CTS 8베이 자리 3장·POS 1공장 옥외의장 6장·3DS 정련동 1장이 이 경우였다 — 베이가
     * 아닌 그 자리는 마당·통로이지 건물이 아니라, 세우면 이름 없는 덩어리가 베이들 옆에
     * 서서 무엇인지 물을 수 없는 것이 된다.
     */
    const groups = unmappedFactoryLots(
      { name: 'F', lotCodes: ['a', 'b'] },
      { ...source({ a: lot(0, 0), b: lot(0.0004, 0) }, { a: 'F', b: 'F' }, ['a']), hasBays: true }
    )
    expect(groups).toHaveLength(0)
  })

  it('남의 공장 지번은 세우지 않는다 — 한 지번이 여러 공장에 속해도 첫 소유 공장만 세운다', () => {
    /* ownerOf 는 첫 소유 공장을 가리킨다. 두 공장이 같은 지번을 들면 같은 자리에 두 채가 선다 */
    const groups = unmappedFactoryLots(
      { name: 'G', lotCodes: ['a'] },
      source({ a: lot(0, 0) }, { a: 'F' })
    )
    expect(groups).toHaveLength(0)
  })

  it('떨어져 선 동은 한 지붕으로 잇지 않는다 — 그 사이 빈 마당까지 건물이 된다', () => {
    /* 두 번째 지번은 100m 남짓 떨어져 있다(붙었다고 보는 3m 를 훌쩍 넘는다) */
    const groups = unmappedFactoryLots(
      { name: 'F', lotCodes: ['a', 'b'] },
      source({ a: lot(0, 0), b: lot(0.0012, 0) }, { a: 'F', b: 'F' })
    )
    expect(groups).toHaveLength(2)
  })

  it('도형이 없거나 세울 수 없는 지번은 조용히 빠진다 — 화면이 비면 안 된다', () => {
    const groups = unmappedFactoryLots(
      { name: 'F', lotCodes: ['a', 'missing', 'line'] },
      source(
        { a: lot(0, 0), line: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }] },
        { a: 'F', missing: 'F', line: 'F' }
      )
    )
    expect(groups.flat().map((entry) => entry.lot)).toEqual(['a'])
  })
})
