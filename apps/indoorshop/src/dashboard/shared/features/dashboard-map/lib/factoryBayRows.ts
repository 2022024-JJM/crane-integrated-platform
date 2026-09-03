import type { YardParcels } from '../../../entities/yard-parcels'
import { summarizeBay, type BaySummary } from './bayDetail'

/*
 * 공장 상세의 **베이 목록** (R14) — 공장 드릴인의 본문은 그 공장의 베이들이다.
 *
 * 각 행은 베이를 클릭했을 때 보이는 상세(BayDetailCard)의 **축약판**이다: 같은 항목의
 * 요약이어야 하고(부분집합), 다른 어휘를 지어내면 안 된다 — 공장→베이가 같은 정보
 * 위계의 **줌 단계**로 읽히려면, 행에서 본 숫자가 상세에서 같은 이름·같은 값으로
 * 다시 나와야 한다. 그래서 행의 데이터도 상세와 **같은 함수**(summarizeBay)에서 온다.
 */

/**
 * 베이 행이 보여주는 필드 — 아래 BAY_DETAIL_FIELDS 의 부분집합이어야 한다
 * (계약 테스트가 지킨다). i18n 키도 상세와 같은 `dashboard.map.{field}` 를 쓴다.
 */
export const FACTORY_BAY_ROW_FIELDS = ['area', 'indoor', 'outdoor'] as const

/** 총괄의 베이 상세(BayDetailCard, showLotList=false)가 실제로 보여주는 필드 */
export const BAY_DETAIL_FIELDS = ['area', 'indoor', 'outdoor'] as const

export type FactoryBayRowField = (typeof FACTORY_BAY_ROW_FIELDS)[number]

/**
 * 공장의 베이 행들 — 상세와 같은 원천(summarizeBay)에서, 매핑 순서 그대로.
 * 매핑에 없는 공장은 빈 목록(그 공장은 지금까지처럼 한 덩어리로 선다).
 */
export function factoryBayRows(parcels: YardParcels, factory: string): BaySummary[] {
  return parcels.bays
    .filter((bay) => bay.factory === factory)
    .map((bay) => summarizeBay(parcels, bay.id))
    .filter((row): row is BaySummary => row !== null)
}
