import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { BasemapLayer, MapTheme } from '../../yard-map'
import { loadYardParcels, type YardParcels } from '../../../entities/yard-parcels'
import { useAsyncData } from '../../../lib/useAsyncData'
import { fetchYardMapBackdrop } from '../../../model/processRegistry'

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
 * `?shop=<공장명>` 딥링크 — 야드/대시보드에서 공장을 누르면 이 쿼리로 온다.
 *
 * 딥링크가 유효하면 그 공장을 골라 지도가 거기서 시작하고, 없으면 첫 공장을 든 채
 * **전체 보기**로 연다(대시보드처럼 야드 전경이 대문). `initialOverview` 는 마운트 시점
 * 한 번만 판단한다 — 이후의 쿼리 변경은 선택만 따라간다.
 */
export function useShopDeepLink(factories: readonly string[]) {
  const [searchParams] = useSearchParams()
  const shopParam = searchParams.get('shop')
  const [selectedFactory, setSelectedFactory] = useState(() =>
    shopParam && factories.includes(shopParam) ? shopParam : (factories[0] ?? '')
  )
  const [initialOverview] = useState(() => !(shopParam && factories.includes(shopParam)))
  useEffect(() => {
    if (shopParam && factories.includes(shopParam)) setSelectedFactory(shopParam)
  }, [shopParam, factories])
  return { selectedFactory, setSelectedFactory, initialOverview }
}
