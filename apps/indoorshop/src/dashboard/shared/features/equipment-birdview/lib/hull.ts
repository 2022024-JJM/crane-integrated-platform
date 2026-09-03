import type { LatLon } from '../../../entities/yard-parcels'
import { LON_SQUEEZE } from './projection'

/*
 * 공장 외곽 — 베이 헐 전부를 감싸는 **볼록 껍질**.
 *
 * 야드 맵이 공장마다 건물 외곽선을 두르는 것과 같은 이유다(`yard-map` 하우스룰): 베이만
 * 흩어 놓으면 그림이 "칸 몇 개"로 읽히고, 그 칸들이 한 공장이라는 사실은 어디에도 없다.
 * 바깥선 하나가 있으면 안쪽의 베이가 비로소 **공장 안의 칸**이 된다.
 *
 * 색을 주지 않는다 — 건물 외곽에 색을 주면 없는 뜻이 생긴다(야드 맵 `shopHull` 과 같은 판단).
 *
 * 볼록 껍질을 쓰는 이유: 실제 건물 모양(오목 포함)을 얻으려면 형태학적 외곽선이 필요한데,
 * 여기 그림은 베이 배치를 읽는 도식이지 도면이 아니다. 볼록 껍질은 계산이 단순하고
 * 베이가 하나뿐인 공장에서도 무너지지 않는다.
 */

/** 경도 압축을 되돌린 평면 좌표 — 껍질 계산은 화면과 같은 비율에서 해야 한다 */
function planar(point: LatLon): { x: number; y: number } {
  return { x: point.lon * LON_SQUEEZE, y: point.lat }
}

function cross(
  o: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/**
 * 모든 베이 헐 점을 감싸는 볼록 껍질 (Andrew monotone chain).
 *
 * 점이 3개 미만이면 껍질이 도형이 되지 못하므로 빈 배열을 준다 — 선 하나를 "공장 외곽"
 * 이라고 그리면 그림이 거짓말을 한다.
 */
export function convexHullOf(points: readonly LatLon[]): LatLon[] {
  if (points.length < 3) return []

  /* 정렬은 결정적이어야 한다 — 같은 입력이 폴링마다 다른 껍질을 내면 선이 떨린다 */
  const sorted = [...points].sort((a, b) => {
    const pa = planar(a)
    const pb = planar(b)
    return pa.x === pb.x ? pa.y - pb.y : pa.x - pb.x
  })

  const build = (list: readonly LatLon[]): LatLon[] => {
    const chain: LatLon[] = []
    for (const point of list) {
      while (
        chain.length >= 2 &&
        cross(planar(chain[chain.length - 2]), planar(chain[chain.length - 1]), planar(point)) <= 0
      ) {
        chain.pop()
      }
      chain.push(point)
    }
    chain.pop()
    return chain
  }

  const hull = [...build(sorted), ...build([...sorted].reverse())]
  return hull.length >= 3 ? hull : []
}
