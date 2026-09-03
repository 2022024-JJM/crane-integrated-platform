import { parseDrilldown } from './drilldownUrl'

/*
 * 공정존에 들어왔을 때 **어느 공장을 펴 놓을 것인가** (R22).
 *
 * 공정마다 있던 맵 진입 화면을 걷으면서, `/indoorshop/zones/{공정}` 의 대문이 워크스페이스가 됐다.
 * 그런데 워크스페이스는 원래 공장 하나를 경로로 받는 화면이었다(`/indoorshop/zones/assembly/asm-gbs`) —
 * 공장 없이 들어오는 길이 새로 생긴 것이다. 그 길에서 무엇을 펼지 정하는 규칙이 여기다:
 *
 *   1. 경로의 공장(`:factoryId`) — 기존 링크·북마크가 그대로 산다.
 *   2. 드릴다운 쿼리(`?factory=`) — 총괄('/')의 '공정 화면으로' 점프가 실어 보내는 값.
 *      슬러그든 이름이든 `parseDrilldown` 이 이름으로 되읽어 주므로 여기서는 이름만 본다.
 *   3. 첫 공장 — 아무 단서가 없으면 목록의 처음을 편다. 빈 화면을 세우고 "고르세요"라
 *      말하는 대신, 뭐라도 보여 주고 왼쪽 레일에서 갈아타게 한다.
 *
 * 순수 함수다 — 세 공정이 같은 규칙을 쓰는지 테스트가 한 자리에서 잠근다.
 */

export interface ZoneFactoryRef {
  /** 라우트 조각이자 데이터 키 (`asm-gbs`·`ofit-pos1`·`pnt-1dock`) */
  id: string
  /** 지도·로스터가 쓰는 공장 이름 (`GBS`·`POS 1공장`·`1DOCK 도장공장`) */
  name: string
}

export interface ZoneEntryParams {
  /** 경로의 `:factoryId` — 없으면 공장 없이 들어온 것 */
  factoryId?: string
  /** 주소의 쿼리 문자열 또는 URLSearchParams (`?factory=`·옛 `?shop=` 모두 읽는다) */
  search?: URLSearchParams | string
}

/**
 * 펼 공장의 id. 목록이 비었으면 null — 없는 공장을 지어내지 않는다.
 * 경로의 factoryId 가 목록에 없으면 그대로 돌려준다(화면이 '없는 공장' 안내를 세운다).
 */
export function resolveZoneFactoryId(
  factories: readonly ZoneFactoryRef[],
  { factoryId, search }: ZoneEntryParams
): string | null {
  if (factoryId) return factoryId
  if (factories.length === 0) return null

  const wanted = search != null ? parseDrilldown(search).factory : null
  if (wanted) {
    const hit = factories.find((f) => f.name === wanted || f.id === wanted)
    if (hit) return hit.id
  }
  return factories[0].id
}

/**
 * 점프가 실어 온 베이(`?bay=`) — `{공장}#{베이}` 에서 베이 조각만. 없으면 null.
 *
 * 워크스페이스의 작업 위치 id 와 곧바로 같지는 않다(지도의 베이와 공정의 정반은 다른
 * 단위다) — 화면이 제 목록에서 짝을 찾는 데 쓰는 **힌트**다.
 */
export function zoneEntryBay(search: URLSearchParams | string): string | null {
  const { factory, bay } = parseDrilldown(search)
  if (!bay) return null
  return factory && bay.startsWith(`${factory}#`) ? bay.slice(factory.length + 1) : bay
}
