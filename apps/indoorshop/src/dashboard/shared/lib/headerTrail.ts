import { useEffect, useSyncExternalStore } from 'react'

/*
 * 헤더 경로에 **화면 안의 뎁스**를 덧붙이는 통로.
 *
 * 헤더는 라우트만 안다(`getBreadcrumb(pathname)` — "전체 현황 › 야드 맵"). 그런데 야드
 * 맵처럼 한 라우트 안에서 공정 → 공장 → 베이로 파고드는 화면은 그 뎁스가 주소의 쿼리와
 * 화면 상태에 있어 헤더가 볼 수 없다. 화면이 자기 뎁스를 여기 **게시**하면 헤더가 라우트
 * 경로 뒤에 이어 붙이고, 각 조각을 눌러 그 뎁스로 돌아갈 수 있게 한다.
 *
 * 게시하는 화면이 사라지면(언마운트) 비운다 — 다른 화면의 헤더에 남은 뎁스가 붙지 않게.
 * 한 번에 한 화면만 게시한다고 본다(라우트 하나에 지도 하나).
 */

/** 뎁스 한 조각 */
export interface HeaderTrailStep {
  key: string
  label: string
  /** 갈 곳. null 이면 지금 서 있는 자리라 링크가 아니다 */
  href: string | null
}

export interface HeaderTrail {
  /** 라우트 라벨(예: '야드 맵')이 가리킬 곳 — 뎁스를 전부 풀고 화면 첫 자리로 */
  rootHref: string
  /** 라우트 라벨 뒤에 붙는 뎁스 — 마지막 조각은 지금 자리(href null) */
  steps: readonly HeaderTrailStep[]
}

let current: HeaderTrail | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 헤더가 읽는다 — 게시된 뎁스, 없으면 null */
export function useHeaderTrail(): HeaderTrail | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}

/** 같은 내용이면 다시 알리지 않는다 — 매 렌더 새 배열이 와도 헤더가 흔들리지 않게 */
function keyOf(trail: HeaderTrail | null): string {
  return trail ? JSON.stringify(trail) : ''
}

/**
 * 화면이 자기 뎁스를 게시한다. `null` 이면 붙일 뎁스가 없다(화면 첫 자리).
 * 언마운트하면 거둔다.
 */
export function usePublishHeaderTrail(trail: HeaderTrail | null): void {
  const key = keyOf(trail)
  useEffect(() => {
    if (keyOf(current) !== key) {
      current = trail
      emit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 내용(key)이 같으면 다시 게시하지 않는다
  }, [key])
  useEffect(
    () => () => {
      current = null
      emit()
    },
    []
  )
}
