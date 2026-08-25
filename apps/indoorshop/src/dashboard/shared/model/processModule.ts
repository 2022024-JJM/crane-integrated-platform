import type { ComponentType } from 'react'
import type { InshopKey } from '../lib/i18n/keys'
import type { RouteObject } from 'react-router-dom'
import type { Zone } from '../entities/zone/model/types'
import type { FactoryOverview } from '../entities/factory/model/overview'

/**
 * 공정 모듈이 앱에 자신을 알리는 형식.
 *
 * 여기 있는 것을 각 모듈이 **스스로 선언**하고, 중앙(app/bootstrap)은 모으기만 한다.
 * 라우트·네비게이션 항목·번역 조각·대시보드 카드를 더할 때 공통 파일을 열 일이
 * 없으므로, 공정별 작업이 서로 같은 줄에서 부딪히지 않는다.
 */

/** 사이드바 아이콘 — `shared/ui/icons` 의 아이콘들과 같은 형태 */
export type ProcessIcon = ComponentType<{ className?: string; size?: number }>

/**
 * 네비게이션 묶음.
 * 물류(야드)는 공정존이 아니라 그 사이를 잇는 일이라 따로 선다.
 */
export type ProcessNavGroupId = 'zones' | 'logistics'

export interface ProcessNavEntry {
  path: string
  /** 아이콘·번역 키의 기준이 되는 안정된 식별자 (라벨은 언어마다 바뀐다) */
  id: string
  labelKey: InshopKey
  icon: ProcessIcon
  /** 이 공정이 실적을 수집하는 데이터 출처 (사이드바·툴바에 표기) */
  source?: string
}

/**
 * 다른 화면이 이 모듈에서 **읽어 갈 수 있는** 데이터.
 *
 * 공정 모듈끼리 직접 import 하지 않기 위한 통로다 — 예를 들어 야드 화면은
 * 조립 모듈을 부르지 않고 레지스트리에 "공장 현황을 내는 모듈"을 물어본다.
 */
export interface ProcessProvides {
  factoryOverviews?: () => Promise<FactoryOverview[]>
}

export interface ProcessModule {
  id: string
  /** 사이드바에 서는 순서 — 배열에 넣은 차례가 아니라 이 값이 기준이다 */
  order: number
  navGroup: ProcessNavGroupId
  nav: ProcessNavEntry
  /** 이 모듈이 담당하는 라우트 전부 (`Component` 는 lazy 로 둬서 청크를 나눈다) */
  routes: RouteObject[]
  /** 이 모듈이 소유하는 번역 조각 — 공통 로케일 파일에 병합된다 */
  i18n: { ko: object; en: object }
  /** 대시보드 공정존 카드. 공정존이 아닌 모듈(야드)은 두지 않는다 */
  zone?: Zone
  provides?: ProcessProvides
}
