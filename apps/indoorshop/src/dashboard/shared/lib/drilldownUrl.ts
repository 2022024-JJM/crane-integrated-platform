/*
 * 지도 화면의 **드릴다운 상태를 URL 로 승격**하는 계약.
 *
 * 예전에는 "지금 어느 공장의 어느 베이를 보고 있는가"가 화면 안 useState 에만 있었다.
 * 그래서 새로고침하면 대문으로 돌아가고, 화면을 링크로 건네면 상대는 내가 본 자리가
 * 아니라 대문을 보고, 뒤로가기는 드릴아웃이 아니라 **이전 화면**으로 나가 버렸다.
 *
 * 자리를 URL 에 두면 그 셋이 한꺼번에 풀린다 — 새로고침·링크 공유가 자리를 보존하고,
 * 드릴다운이 히스토리를 쌓으므로(push) 브라우저 뒤로가기가 곧 드릴아웃이 된다.
 * 브레드크럼은 그 상태를 **표현**할 뿐 따로 상태를 들지 않는다(이중 소스 금지).
 *
 * 이 파일은 계약의 순수 부분이다 — React 도 라우터도 모른다. 화면에서 쓰는 훅은
 * `useDrilldown.ts`, 소비하는 쪽(총괄 지도·공정 맵 프레임·글로벌 검색)은 전부 여기
 * 함수만 부른다. 파싱/생성을 각자 손으로 하면 화면마다 규칙이 어긋난다.
 *
 * ## 파라미터
 *
 * | 키 | 뜻 | 비고 |
 * |---|---|---|
 * | `process` | 공정존 스포트라이트 | 총괄('/') 전용 — 공정 화면은 화면 자체가 공정이다 |
 * | `factory` | 드릴인한 공장 이름 | 없으면 **전체 보기**(야드 전경) |
 * | `bay`     | 그 공장 안에서 고른 베이 id | `factory` 없이는 뜻이 없다 |
 * | `shop`    | `factory` 의 옛 이름 | **읽기만** — 쓸 때는 `factory` 로 정규화한다 |
 *
 * 통합실적·조립 화면이 쓰는 `vessel`·`block`·`assy`·`date` 등 다른 쿼리와 **공존**한다.
 * 여기 함수들은 자기 키만 건드리고 나머지는 그대로 실어 나른다.
 */

/** 드릴다운이 쓰는 쿼리 키 — 화면에서 문자열을 손으로 적지 않게 한다 */
export const DRILLDOWN_PARAM = {
  process: 'process',
  factory: 'factory',
  bay: 'bay',
} as const

/**
 * `factory` 의 옛 이름. 도장 화면이 `?shop=` 으로 먼저 났고 야드·통합실적의 링크가
 * 그 철자로 나간다 — 읽을 때는 받아 주고, 쓸 때는 `factory` 로 정규화한다(한 자리에
 * 뜻이 다른 두 철자가 남으면 어느 쪽이 진짜인지 아무도 모르게 된다).
 */
export const LEGACY_FACTORY_PARAM = 'shop'

/** 드릴다운의 깊이 — 브레드크럼 조각 수이자 ESC 한 단계 위의 기준 */
export type DrilldownLevel = 'yard' | 'process' | 'factory' | 'bay'

export interface DrilldownState {
  /** 공정존 스포트라이트 (총괄 화면). 공정 화면에서는 언제나 null */
  process: string | null
  /** 드릴인한 공장. null 이면 전체 보기 */
  factory: string | null
  /** 고른 베이(`YardParcelBay.id`). factory 없이는 설 수 없다 */
  bay: string | null
}

/** 최상위 — 아무것도 고르지 않은 야드 전경 */
export const YARD_DRILLDOWN: DrilldownState = { process: null, factory: null, bay: null }

function clean(value: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function toParams(source: URLSearchParams | string): URLSearchParams {
  return typeof source === 'string' ? new URLSearchParams(source) : source
}

/**
 * URL 에서 드릴다운을 읽는다.
 *
 * 공장이 없으면 베이도 없는 것으로 친다 — `?bay=` 만 남은 URL(손으로 지웠거나 낡은
 * 링크)을 "공장 없는 베이"로 들고 있으면 화면이 표현할 수 없는 상태가 된다.
 */
export function parseDrilldown(source: URLSearchParams | string): DrilldownState {
  const params = toParams(source)
  const factory =
    clean(params.get(DRILLDOWN_PARAM.factory)) ?? clean(params.get(LEGACY_FACTORY_PARAM))
  return {
    process: clean(params.get(DRILLDOWN_PARAM.process)),
    factory,
    bay: factory ? clean(params.get(DRILLDOWN_PARAM.bay)) : null,
  }
}

export function drilldownLevel(state: DrilldownState): DrilldownLevel {
  if (state.bay) return 'bay'
  if (state.factory) return 'factory'
  if (state.process) return 'process'
  return 'yard'
}

/**
 * 한 단계를 바꾼다 — **상위를 건드리면 하위는 버린다**.
 *
 * 공장을 갈아타면 이전 공장의 베이는 뜻을 잃고, 공정을 갈아타면 그 아래 공장·베이가
 * 함께 뜻을 잃는다. 이 규칙을 화면 여기저기의 setState 에 흩어 두면 한 곳만 고치고
 * 다른 곳을 잊는다(mapSpotlight 의 전이 함수와 같은 이유로 여기 모아 둔다).
 *
 * 패치에 명시한 하위 값은 살린다 — `{ factory: 'X', bay: 'X#A' }` 처럼 한 번에
 * 깊이 들어가는 링크(글로벌 검색 결과)가 성립해야 하기 때문이다.
 */
export function narrowDrilldown(
  state: DrilldownState,
  patch: Partial<DrilldownState>,
): DrilldownState {
  const next: DrilldownState = { ...state }

  if ('process' in patch) {
    next.process = clean(patch.process ?? null)
    if (next.process !== state.process) {
      next.factory = null
      next.bay = null
    }
  }
  if ('factory' in patch) {
    next.factory = clean(patch.factory ?? null)
    if (next.factory !== state.factory) next.bay = null
  }
  if ('bay' in patch) next.bay = clean(patch.bay ?? null)

  /* 공장이 없으면 베이도 설 수 없다 — 패치가 무엇을 주든 이 규칙이 이긴다 */
  if (!next.factory) next.bay = null
  return next
}

/**
 * 한 단계 위 — ESC 와 브레드크럼 뒷조각이 같은 계단을 쓴다.
 * 최상위(야드)에서는 그대로 둔다(더 올라갈 곳이 없다).
 */
export function parentDrilldown(state: DrilldownState): DrilldownState {
  if (state.bay) return { ...state, bay: null }
  if (state.factory) return { ...state, factory: null, bay: null }
  if (state.process) return { ...YARD_DRILLDOWN }
  return state
}

/** 이미 최상위인가 — ESC 를 삼킬지(아무 일도 안 할지) 판단하는 자리 */
export function isTopDrilldown(state: DrilldownState): boolean {
  return drilldownLevel(state) === 'yard'
}

/**
 * 드릴다운을 URL 파라미터에 적는다 — **자기 키만** 건드린다.
 *
 * 통합실적의 `?vessel=&block=`, 조립의 `?assy=&date=` 는 그대로 실려 간다. 낡은
 * `?shop=` 은 지운다(정규화 — 위 LEGACY_FACTORY_PARAM 주석 참조).
 */
export function writeDrilldown(
  source: URLSearchParams | string,
  state: DrilldownState,
): URLSearchParams {
  const next = new URLSearchParams(toParams(source))
  next.delete(LEGACY_FACTORY_PARAM)
  for (const [key, value] of [
    [DRILLDOWN_PARAM.process, state.process],
    [DRILLDOWN_PARAM.factory, state.factory],
    [DRILLDOWN_PARAM.bay, state.bay],
  ] as const) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return next
}

/** `?a=b` 꼴 문자열. 남는 것이 없으면 빈 문자열 — `?` 만 달린 URL 을 만들지 않는다 */
export function drilldownSearch(
  source: URLSearchParams | string,
  state: DrilldownState,
): string {
  const query = writeDrilldown(source, state).toString()
  return query ? `?${query}` : ''
}

/** 링크(`<Link to>`)에 그대로 넣는 경로 + 쿼리 */
export function drilldownHref(
  pathname: string,
  source: URLSearchParams | string,
  state: DrilldownState,
): string {
  return `${pathname}${drilldownSearch(source, state)}`
}
