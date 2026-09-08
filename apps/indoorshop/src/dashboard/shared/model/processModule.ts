import type { ComponentType } from 'react'
import type { InshopKey } from '../lib/i18n/keys'
import type { RouteObject } from 'react-router-dom'
import type { Zone } from '../entities/zone/model/types'
import type { FactoryOverview } from '../entities/factory/model/overview'
import type { ProcessMapDrilldownProvider } from './processMapDrilldown'
import type { ProcessFacilityAnchor } from './processFacilityAnchor'
import type { YardMapBackdrop } from './yardMapBackdrop'

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
  /** true 면 사이드바에 표시하지 않는다 — 라우트는 살아 있고 화면 노출만 가린다 */
  hidden?: boolean
}

/**
 * 다른 화면이 이 모듈에서 **읽어 갈 수 있는** 데이터.
 *
 * 공정 모듈끼리 직접 import 하지 않기 위한 통로다 — 예를 들어 야드 화면은
 * 조립 모듈을 부르지 않고 레지스트리에 "공장 현황을 내는 모듈"을 물어본다.
 */
export interface ProcessProvides {
  /**
   * 공장 현황 집계. **기준일을 받는다** — 주지 않으면 오늘이라 기존 호출부는 그대로다.
   * 야드가 `?date=` 로 되감긴 화면을 보고 있으면 그 날짜가 여기로 흘러들어야, 지도 위
   * 정반과 옆 목록이 같은 날을 말한다(연계 매트릭스 §2.3).
   */
  factoryOverviews?: (baseDate?: string) => Promise<FactoryOverview[]>
  /**
   * 공정존 → 지도상의 대표 시설·좌표. 야드가 41개 시설의 공정 귀속·좌표를 알아
   * 이것을 채우고, 대시보드는 레지스트리(`fetchProcessFacilityAnchors`)로 읽는다.
   */
  facilityAnchors?: () => Promise<ProcessFacilityAnchor[]>
  /**
   * 야드 지도 배경(베이스맵·범위·색·시설·블록 색인) — 야드 지도를 배경으로 깔려는
   * 화면 전부가 쓰는 **단일 통로**다(대시보드 전체 현황 지도, 공정 맵 진입 화면).
   * 무게(베이스맵 ~980KB)가 초기 번들에 실리지 않도록 야드가 lazy 로 내보내고,
   * 부르는 쪽은 레지스트리(`fetchYardMapBackdrop`)로 읽는다. 필요한 필드만 골라 쓰면
   * 되므로(예: 맵 진입 화면은 베이스맵·범위만) 배경 provides 를 더 만들지 않는다.
   */
  mapBackdrop?: () => Promise<YardMapBackdrop>
  /**
   * 전체 현황 지도의 **작업 위치 드릴다운**(PRD FR-3) — 공정 → 공장 다음 단계인
   * 작업 위치의 명칭·조회·상세 경로를 이 공정이 소유해 낸다. 대시보드는 레지스트리
   * (`getProcessMapDrilldown`)로 읽으며, 내지 않는 공정은 오류가 아니라
   * "작업 위치 상세 미제공" 으로 다뤄진다 — 계약은 **선택적**이다.
   */
  mapDrilldown?: ProcessMapDrilldownProvider
  /**
   * 의장 **재공 블록**과 그 판별 진척 — 통합실적의 의장 레일이 읽어 간다(W7-11).
   *
   * 통합실적은 shared 라 공정 모듈을 부를 수 없다. 그런데 의장 카드가 쓸 수치는
   * **의장 공장 화면이 쓰는 바로 그 값**이어야 한다(연계 매트릭스 원칙 — 화면마다 제
   * 해시로 진척을 지어내면 같은 블록이 두 숫자를 갖는다). 그래서 의장이 내고 통합실적이
   * 레지스트리로 읽는다.
   *
   * 기준일을 받는다 — 통합실적이 되감긴 날을 보고 있으면 의장 줄도 그 날이어야 한다.
   */
  outfittingBlocks?: (baseDate?: string) => Promise<OutfittingWipBlock[]>
}

/**
 * 의장 재공 블록 한 장 — **공정 모듈과 shared 사이의 계약**.
 *
 * 의장 모듈의 `OutfittingBlock` 을 그대로 쓰지 않는 이유는 shared 가 공정 타입을 알게
 * 되기 때문이다. 여기 있는 것은 통합실적이 실제로 읽는 필드뿐이고, 문자열 유니온은
 * 데이터이지 모듈 의존이 아니다.
 *
 * ⚠️ **블록 단위다.** 의장에는 조립 같은 계층이 없다 — 그 어휘가 흘러들지 않게 필드
 * 이름에서부터 막는다(`processes/outfitting/__tests__/noAssemblyHierarchy`).
 */
export interface OutfittingWipBlock {
  projNo: string
  blockNo: string
  factoryId: string
  /** 놓인 구역 이름 */
  areaName: string
  /** 송선기호 */
  wstgCode: string
  /** 라이다 기반 판별 진척(%) — 의장의 유일한 축 */
  judgedRate: number
  status: 'waiting' | 'in_progress' | 'completed'
  /** 조립을 막 끝내고 어제 들어왔는가 */
  justArrived: boolean
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
