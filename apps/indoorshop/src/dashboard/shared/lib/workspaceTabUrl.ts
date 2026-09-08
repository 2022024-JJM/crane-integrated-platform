/*
 * 워크스페이스 **축 탭을 URL 로 승격**하는 계약.
 *
 * 축 탭(현황 / 3D 뷰어 / 블록·실적)은 화면 안 `useState` 였다. 그래서 밖에서 들어오는
 * 링크는 자기가 어느 축에 내려서야 하는지 말할 방법이 없었고, 결과적으로 **기본 탭이 곧
 * 착지 탭**이었다. 축 순서를 [3D → 현황] 에서 [현황 → 3D] 로 뒤집자(P4) 통합실적의
 * 'PCD 뷰' 가 3D 가 아니라 현황에 내려앉은 사고가 그것이다 — 링크는 그대로인데 도착지가
 * 바뀌었다.
 *
 * 자리를 URL 에 두면 그 고리가 끊긴다: 링크가 자기 착지점을 스스로 말하므로, 기본 탭을
 * 앞으로 몇 번 더 바꿔도 그 링크는 흔들리지 않는다. 드릴다운(`drilldownUrl`)이 "어느
 * 공장의 어느 베이"를 URL 에 올린 것과 같은 이유이고, 같은 규칙으로 **자기 키만 건드리고
 * 나머지 쿼리는 그대로 실어 나른다**(`block`·`date`·`vessel` 과 공존한다).
 *
 * 유효한 값은 화면마다 다르다 — 조립·의장은 `viewer`, 도장은 제 철자를 쓴다. 그래서 이
 * 파일은 **키와 검증**만 갖고, 무엇이 유효한지는 화면이 자기 탭 목록으로 답한다. 모르는
 * 값이 오면 `null` 이고 화면은 제 기본 탭에 그대로 선다 — 없는 탭을 지어내지 않는다.
 */

/** 착지 탭 쿼리 키 — 화면에서 문자열을 손으로 적지 않게 한다 */
export const WORKSPACE_TAB_PARAM = 'tab'

/**
 * 3D 뷰어 축의 철자 — 조립·의장 워크스페이스가 쓰는 탭 키와 같은 값이다.
 * 링크를 만드는 쪽(로스터의 PCD 뷰 경로)과 받는 쪽(워크스페이스)이 이 상수를 함께 본다.
 */
export const VIEWER_TAB = 'viewer'

/**
 * URL 이 실어 온 착지 탭 — 이 화면이 실제로 가진 축일 때만 돌려준다.
 *
 * 모르는 값(옛 링크·손으로 고친 URL)에 화면이 빈 칸으로 서면 고장으로 읽힌다.
 * 그래서 판정은 하나뿐이다: 목록에 있으면 그 탭, 없으면 `null`(기본 탭에 그대로).
 */
export function workspaceTabOf<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[]
): T | null {
  if (!raw) return null
  return allowed.includes(raw as T) ? (raw as T) : null
}

/**
 * 이 경로에 착지 탭을 실어 준다 — 이미 쿼리가 붙어 있으면 이어 붙인다.
 * (경로를 만드는 쪽이 `?` 인지 `&` 인지를 매번 손으로 고르면 언젠가 한 곳이 틀린다.)
 */
export function withWorkspaceTab(path: string, tab: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${WORKSPACE_TAB_PARAM}=${tab}`
}

/**
 * **화면 안 이동은 보던 축을 유지한다** (R30) — 지금 서 있는 축을 다음 자리에 실어 준다.
 *
 * 착지 탭을 URL 로 올린 뒤(R28) 남은 구멍이 이것이었다: 밖에서 들어오는 링크는 제
 * 도착지를 말하게 됐는데, **화면 안에서 일어나는 이동**(3D 뷰어에서 공장→베이 드릴,
 * 베이→공장 복귀, 베이 간 이동)은 경로만 갈아 끼우고 `?tab=` 을 두고 갔다. 그래서
 * 3D 를 보다 정반을 누르면 도착 화면이 기본 탭(현황)으로 서고, 방금 한 조작의 결과를
 * 못 보게 됐다 — 몰입이 끊기는 자리다.
 *
 * 승계는 **원값 그대로** 나른다. 무엇이 유효한 축인지는 도착 화면이 자기 목록으로
 * 판정하므로(`workspaceTabOf`), 여기서 한 번 더 거르면 판정이 두 곳으로 갈린다.
 * 모르는 값이 실려 가도 도착 화면은 제 기본 탭에 그대로 선다.
 *
 * 이미 `?tab=` 을 실은 경로는 건드리지 않는다 — **링크가 제 도착지를 말한 경우가
 * 먼저다**(로스터의 'PCD 뷰' 처럼 목적지를 명시한 링크가 승계에 덮이면 안 된다).
 */
export function carryWorkspaceTab(path: string, current: string | null | undefined): string {
  if (!current) return path
  const [, query = ''] = path.split('?')
  if (new URLSearchParams(query).has(WORKSPACE_TAB_PARAM)) return path
  return withWorkspaceTab(path, current)
}
