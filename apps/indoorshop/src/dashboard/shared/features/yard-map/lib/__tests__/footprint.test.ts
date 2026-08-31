import { describe, expect, it } from 'vitest'
import { ringSitsOn } from '../footprint'
import { boundsOf, type LatLon } from '../../model/types'

/**
 * 회색 OSM 건물을 공장이 가져가는(= 회색 층에서 빼는) 판정.
 *
 * 공장 자리에 공정색 도형과 회색 건물이 함께 서면 두 모형이 겹쳐 어긋난 것처럼 보인다.
 * 그렇다고 스치기만 한 건물까지 지우면 공장 밖 배경이 뚫린다 — 그 경계가 이 판정이다.
 */
describe('ringSitsOn — 회색 건물이 공장 지번 위에 서 있는가', () => {
  const square = (lat: number, lon: number, size: number): LatLon[] => [
    { lat, lon },
    { lat, lon: lon + size },
    { lat: lat + size, lon: lon + size },
    { lat: lat + size, lon },
  ]
  const shape = (lat: number, lon: number, size: number) => {
    const polygon = square(lat, lon, size)
    return { polygon, bounds: boundsOf(polygon) }
  }
  /** OSM 링은 [경도, 위도] 짝이다 — 지번 폴리곤과 축 순서가 반대인 것에 주의 */
  const ring = (lat: number, lon: number, size: number) =>
    square(lat, lon, size).map((p) => [p.lon, p.lat] as [number, number])

  it('지번 안에 선 건물은 그 공장이 가져간다', () => {
    expect(ringSitsOn(ring(34.8702, 128.6902, 0.0004), [shape(34.87, 128.69, 0.001)])).toBe(true)
  })

  it('지번 밖의 건물은 배경으로 남는다', () => {
    expect(ringSitsOn(ring(34.8802, 128.6802, 0.0004), [shape(34.87, 128.69, 0.001)])).toBe(false)
  })

  it('모서리만 걸친 건물은 남는다 — 어느 쪽 중심도 상대 안에 들지 않는다', () => {
    /* 지번의 오른쪽 위 모서리에 살짝 겹치되 서로의 중심은 바깥에 있는 건물 */
    expect(ringSitsOn(ring(34.8709, 128.6909, 0.0004), [shape(34.87, 128.69, 0.001)])).toBe(false)
  })

  it('건물이 지번을 통째로 품으면(지번 중심이 건물 안) 그 공장이 가져간다', () => {
    /* 텍사코 T4·T5 — 건물 하나가 지번 여러 장을 품어 건물 중심은 무소속 지번 위에 떨어진다 */
    expect(ringSitsOn(ring(34.87, 128.69, 0.002), [shape(34.8701, 128.6901, 0.0004)])).toBe(true)
  })

  it('지번이 여럿이면 그중 하나만 품어도 가져간다', () => {
    const shapes = [shape(34.87, 128.69, 0.001), shape(34.88, 128.7, 0.001)]
    expect(ringSitsOn(ring(34.8802, 128.7002, 0.0004), shapes)).toBe(true)
  })

  it('지번이 없거나 링이 도형이 아니면 가져가지 않는다', () => {
    expect(ringSitsOn(ring(34.8702, 128.6902, 0.0004), [])).toBe(false)
    expect(ringSitsOn([[128.69, 34.87], [128.691, 34.87]], [shape(34.87, 128.69, 0.001)])).toBe(false)
  })
})
