import { useCallback } from 'react'
import type { BasemapLayer, MapTheme } from '../../yard-map'
import { loadYardParcels, type YardParcels } from '../../../entities/yard-parcels'
import { useAsyncData } from '../../../lib/useAsyncData'
import { fetchYardMapBackdrop } from '../../../model/processRegistry'
import { useDrilldown } from '../../../lib/useDrilldown'

const EMPTY_BASEMAP: Record<MapTheme, BasemapLayer[]> = { dark: [], light: [] }

/**
 * 맵 진입 화면의 공통 데이터 — 지번/공장(fixture)과 베이스맵 배경.
 *
 * 지번은 lazy 로 이 화면에서만 실리고, 배경은 야드가 `provides` 로 낸다(processRegistry
 * 경유 — shared 가 야드 모듈을 import 하지 않는 길). 배경이 없어도 지번은 그린다.
 */
export function useMapEntryData() {
  const { data: parcels } = useAsyncData<YardParcels>(() => loadYardParcels(), [])
  const { data: background } = useAsyncData(() => fetchYardMapBackdrop(), [])
  return {
    parcels: parcels ?? null,
    basemapLayers: background?.basemapLayers ?? EMPTY_BASEMAP,
    yardExtent: background?.extent ?? null,
  }
}

/**
 * 드릴인한 공장을 **URL 에서** 읽고 쓴다 — `?factory=<공장명>` (옛 철자 `?shop=` 도 읽는다).
 *
 * 예전에는 이 값이 화면 안 useState 였고 쿼리는 마운트 때 한 번 베껴 오는 씨앗이었다.
 * 그래서 새로고침은 대문으로 돌아갔고, 뒤로가기는 드릴아웃이 아니라 **이전 화면**으로
 * 나갔다. 이제 URL 이 원본이다 — 자리를 링크로 건넬 수 있고, 드릴인이 히스토리를 쌓아
 * (push) 뒤로가기가 곧 드릴아웃이 된다. 규칙은 `shared/lib/drilldownUrl` 참조.
 *
 * 쿼리에 없거나 이 화면의 공장이 아니면 **전체 보기**로 연다(대시보드처럼 야드 전경이
 * 대문). 그때도 `selectedFactory` 는 첫 공장을 들고 있는데, 카드·범위 계산이 이름 하나를
 * 늘 필요로 하기 때문이다 — "전체 보기인가"는 `initialOverview`/URL 이 말한다.
 *
 * 이 화면에서 `?factory=` 를 쓰는 손은 여기 하나뿐이다(프레임의 '전체 보기'도
 * `onSelectFactory(null)` 로 여기를 지난다) — 한 파라미터에 쓰는 손이 둘이면 어느 쪽이
 * 이겼는지 화면만 보고는 알 수 없게 된다.
 */
export function useShopDeepLink(factories: readonly string[]) {
  const drill = useDrilldown()
  const urlFactory = drill.factory && factories.includes(drill.factory) ? drill.factory : null

  const setSelectedFactory = useCallback(
    (name: string | null) => drill.go({ factory: name }),
    [drill]
  )

  return {
    selectedFactory: urlFactory ?? factories[0] ?? '',
    setSelectedFactory,
    /** 지금 전체 보기인가 — 이름은 옛 계약을 지키지만 값은 마운트 뒤에도 URL 을 따라간다 */
    initialOverview: urlFactory == null,
  }
}
