import { describe, expect, it } from 'vitest'
import {
  FILL,
  ROOF_LIGHT,
  SUN,
  WALL_LIGHT,
  isCounterClockwise,
  lightOf,
  shadowOffset,
  slopeLightOf,
  wallLightOf,
  wallNormal,
} from '../lighting'
import type { LatLon } from '../../model/types'

/**
 * 세운 도형에 빛을 먹이는 규칙.
 *
 * 여기서 지키는 것은 색값이 아니라 **관계**다 — 해를 본 면이 등진 면보다 밝고, 박공 두
 * 면이 서로 갈리고, 그림자가 해 반대쪽으로 눕는다. 상수(방위·고도·세기)는 보기에 맞춰
 * 손볼 표현값이므로 숫자를 고정하지 않는다.
 */

/** 반시계로 감은 정사각형 (동쪽으로 lon+, 북쪽으로 lat+) */
const ccwSquare: LatLon[] = [
  { lat: 34.87, lon: 128.69 },
  { lat: 34.87, lon: 128.691 },
  { lat: 34.871, lon: 128.691 },
  { lat: 34.871, lon: 128.69 },
]

describe('감김 — 벽의 바깥쪽을 정하는 부호', () => {
  it('반시계로 감은 폴리곤을 반시계라고 본다', () => {
    expect(isCounterClockwise(ccwSquare)).toBe(true)
  })

  it('뒤집으면 시계다', () => {
    expect(isCounterClockwise([...ccwSquare].reverse())).toBe(false)
  })

  it('반시계 폴리곤의 남쪽 변은 바깥이 남쪽이다', () => {
    const n = wallNormal(ccwSquare[0], ccwSquare[1], true)
    expect(n).not.toBeNull()
    expect(n!.y).toBeLessThan(-0.99)
  })

  it('감김이 반대면 바깥도 반대다 — 같은 변이 안팎을 바꿔 서지 않게', () => {
    const out = wallNormal(ccwSquare[0], ccwSquare[1], true)!
    const flipped = wallNormal(ccwSquare[0], ccwSquare[1], false)!
    expect(flipped.x).toBeCloseTo(-out.x, 6)
    expect(flipped.y).toBeCloseTo(-out.y, 6)
  })

  it('길이 0인 변은 방향이 없다 — 없는 법선을 지어내지 않는다', () => {
    expect(wallNormal(ccwSquare[0], { ...ccwSquare[0] }, true)).toBeNull()
  })
})

describe('빛 — 해를 본 면이 등진 면보다 밝다', () => {
  const toward = (azimuthDeg: number) => ({
    x: Math.sin((azimuthDeg * Math.PI) / 180),
    y: Math.cos((azimuthDeg * Math.PI) / 180),
  })

  it('주광을 정면으로 본 벽이 등진 벽보다 밝다', () => {
    const face = toward(SUN.azimuth)
    const lit = lightOf(face.x, face.y, 0, WALL_LIGHT)
    const dark = lightOf(-face.x, -face.y, 0, WALL_LIGHT)
    expect(lit).toBeGreaterThan(dark * 1.4)
  })

  it('어떤 방향이든 배율은 floor 와 floor+gain 사이에 든다 — 색이 넘치지 않게', () => {
    for (let deg = 0; deg < 360; deg += 15) {
      const n = toward(deg)
      const k = lightOf(n.x, n.y, 0, WALL_LIGHT)
      expect(k).toBeGreaterThanOrEqual(WALL_LIGHT.floor)
      expect(k).toBeLessThanOrEqual(WALL_LIGHT.floor + WALL_LIGHT.gain)
    }
  })

  it('등진 벽도 완전히 죽지 않는다 — 감싼 램버트라 뒷면에도 기울기가 남는다', () => {
    const back = toward(SUN.azimuth + 180)
    const side = toward(SUN.azimuth + 90)
    expect(lightOf(side.x, side.y, 0, WALL_LIGHT)).toBeGreaterThan(
      lightOf(back.x, back.y, 0, WALL_LIGHT)
    )
  })

  it('벽 밝기는 변의 방향에서 그대로 나온다 (wallLightOf = lightOf∘wallNormal)', () => {
    const n = wallNormal(ccwSquare[0], ccwSquare[1], true)!
    expect(wallLightOf(ccwSquare[0], ccwSquare[1], true)).toBeCloseTo(
      lightOf(n.x, n.y, 0, WALL_LIGHT),
      10
    )
  })
})

describe('박공 — 마주 보는 두 지붕면은 갈려야 한다', () => {
  const toward = (azimuthDeg: number) => ({
    x: Math.sin((azimuthDeg * Math.PI) / 180),
    y: Math.cos((azimuthDeg * Math.PI) / 180),
  })
  const pitch = 0.44 /* BAY_ROOF.pitch × 2 — 스팬 폭 절반에 대한 용마루 높이의 비 */

  it('평지붕(기울기 0)은 두 방향이 같은 값을 받는다 — 없는 능선을 만들지 않는다', () => {
    const d = toward(30)
    expect(slopeLightOf(d, 0)).toBeCloseTo(slopeLightOf({ x: -d.x, y: -d.y }, 0), 10)
  })

  it('박공은 평지붕을 사이에 두고 갈린다 — 한 면은 더 밝고 한 면은 더 어둡다', () => {
    /* 눕히기만 한 지붕이 두 면보다 밝거나 어두우면, 덩어리에서 박공으로 자라는 동안
       지붕 전체가 한 번 튀었다 돌아온다 (`gable` 이 0→1 로 가는 사이) */
    const flat = slopeLightOf({ x: 1, y: 0 }, 0)
    const down = toward(SUN.azimuth)
    const lit = slopeLightOf(down, pitch)
    const shaded = slopeLightOf({ x: -down.x, y: -down.y }, pitch)
    expect(lit).toBeGreaterThan(flat)
    expect(shaded).toBeLessThan(flat)
  })

  const splitAt = (downslopeDeg: number) => {
    const down = toward(downslopeDeg)
    return Math.abs(slopeLightOf(down, pitch) - slopeLightOf({ x: -down.x, y: -down.y }, pitch))
  }

  it('주광과 **나란한** 용마루도 갈린다 — 보조광이 있는 이유', () => {
    /*
     * 등 하나면 빛과 나란히 누운 용마루에서 두 면이 똑같이 옆으로 빛을 받아 지붕이 한 장의
     * 판이 된다(1DOCK 도장공장의 다섯 스팬이 그랬다). 90° 옆의 보조광이 그 자리를 가른다.
     */
    expect(splitAt(SUN.azimuth + 90)).toBeGreaterThan(0.08)
  })

  it('주광과 **직각인** 용마루는 주광이 가른다 — 보조광을 얹어도 그 대비가 죽지 않게', () => {
    expect(splitAt(SUN.azimuth)).toBeGreaterThan(0.08)
  })

  it('야드의 두 지배적 방향(직교하는 스팬 무리) 모두에서 갈린다', () => {
    expect(splitAt(45)).toBeGreaterThan(0.08)
    expect(splitAt(135)).toBeGreaterThan(0.08)
  })

  it('지붕 배율도 floor~floor+gain 안에 든다', () => {
    for (let deg = 0; deg < 360; deg += 15) {
      const k = slopeLightOf(toward(deg), pitch)
      expect(k).toBeGreaterThanOrEqual(ROOF_LIGHT.floor)
      expect(k).toBeLessThanOrEqual(ROOF_LIGHT.floor + ROOF_LIGHT.gain)
    }
  })

  it('보조광은 주광보다 약하다 — 같은 세기면 어느 면도 확실히 어둡지 않다', () => {
    expect(FILL.weight).toBeGreaterThan(0)
    expect(FILL.weight).toBeLessThan(1)
  })
})

describe('그림자 — 해 반대쪽으로, 높이만큼', () => {
  it('높이가 0이면 그림자도 없다', () => {
    const o = shadowOffset(0)
    expect(o.dLat).toBeCloseTo(0, 12)
    expect(o.dLon).toBeCloseTo(0, 12)
  })

  it('해가 북서(방위 270~360°)면 그림자는 남동으로 눕는다', () => {
    expect(SUN.azimuth).toBeGreaterThan(270)
    expect(SUN.azimuth).toBeLessThan(360)
    const o = shadowOffset(10)
    expect(o.dLat).toBeLessThan(0) /* 남쪽 */
    expect(o.dLon).toBeGreaterThan(0) /* 동쪽 */
  })

  it('높이에 비례해 길어진다', () => {
    const a = shadowOffset(10)
    const b = shadowOffset(20)
    expect(b.dLat).toBeCloseTo(a.dLat * 2, 12)
    expect(b.dLon).toBeCloseTo(a.dLon * 2, 12)
  })

  it('길이는 높이 ÷ tan(고도) 다 — 낮은 해일수록 길다', () => {
    const reachM = 10 / Math.tan((SUN.elevation * Math.PI) / 180)
    /* 경도는 눌린 좌표계로 되돌려 재야 실제 거리가 된다 */
    const LON_SQUEEZE = Math.cos((34.87 * Math.PI) / 180)
    const o = shadowOffset(10)
    const meters = Math.hypot(o.dLat, o.dLon * LON_SQUEEZE) * 111_320
    expect(meters).toBeCloseTo(reachM, 3)
  })
})
