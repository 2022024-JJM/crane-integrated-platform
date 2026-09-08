import type { LatLon, YardParcels } from '../../../entities/yard-parcels'

/*
 * 고른 **베이**의 떠 있는 이름패가 설 자리.
 *
 * 공장을 고르면 지붕에 누워 있던 공장 이름이 일어서 뜬다(FactoryHudLabel). 한 단계 더
 * 내려가 베이를 고르면 그 자리의 주인공은 베이인데, 지금까지 베이 이름은 지붕에 누운
 * 채였고 그 베이로 들어가는 문은 왼쪽 카드 안에만 있었다 — 지도에서 칸을 눌렀는데
 * 다음 걸음은 지도 밖에서 찾아야 했다. 그래서 공장이 쓰던 것과 **같은 패**를 베이에도
 * 세운다: 이름이 떠오르고, 그 밑에 그 베이로 들어가는 문이 붙는다.
 *
 * 자리 계산에 `YardParcelBay.hull` 을 쓰지 않는 것은 의도다 — 그것은 볼록 껍질이라
 * 오목한 스팬에서 지번선 밖으로 부푼다(types.ts 의 주석). 화면의 베이 도형과 같은
 * 원천, 즉 **소속 지번 폴리곤**을 쓴다: 패가 재는 실루엣이 눈에 보이는 건물과 같아야
 * 패가 그 건물 위에 선다.
 *
 * React 밖의 순수 함수라 단위 테스트 대상이다(이 레포의 다른 파생 계산과 같은 이유).
 */

/** 베이 이름패 한 장에 필요한 것 — FactoryHudLabel 의 props 로 그대로 흘러간다 */
export interface BayHudTarget {
  /** `YardParcelBay.id` — `{공장}#{베이}` */
  id: string
  /** 패에 크게 적히는 이름 (예: `6BAY`) */
  name: string
  /** 소속 공장 이름 — 공장 패가 물러난 자리를 캡션이 대신 말한다 */
  factory: string
  /** 공정 (조립/도장/의장/가공). 빈칸이면 null */
  process: string | null
  /** 가로 자리의 기준 — 소속 지번 정점들의 평균(공장 `labelAnchor` 와 같은 잣대) */
  anchor: LatLon
  /** 실루엣을 재는 점들 — 소속 지번 폴리곤의 꼭짓점 전부 */
  outline: LatLon[]
}

/**
 * 고른 베이의 이름패 자리. 매핑에 없는 베이거나 지도 fixture 에 지번이 하나도 없으면
 * null — 잴 실루엣이 없으면 패가 설 자리도 없다(빈 패를 아무 데나 띄우지 않는다).
 */
export function bayHudTarget(parcels: YardParcels, bayId: string): BayHudTarget | null {
  const bay = parcels.bays.find((b) => b.id === bayId)
  if (!bay) return null

  const codes = new Set(bay.lotCodes)
  const outline = parcels.lots.flatMap((lot) => (codes.has(lot.lot) ? lot.polygon : []))
  if (outline.length === 0) return null

  let lat = 0
  let lon = 0
  for (const point of outline) {
    lat += point.lat
    lon += point.lon
  }

  return {
    id: bay.id,
    name: bay.label,
    factory: bay.factory,
    /* 베이 자신의 공정이 먼저다 — 없으면 소속 공장의 것으로 (원본 bays.js 는 빈칸이 있다) */
    process:
      bay.process || parcels.factories.find((f) => f.name === bay.factory)?.process || null,
    anchor: { lat: lat / outline.length, lon: lon / outline.length },
    outline,
  }
}
