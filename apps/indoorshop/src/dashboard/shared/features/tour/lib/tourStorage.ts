/*
 * 투어를 봤다는 기억 — **영구**(localStorage)다. 드래그 카드 자리(session)와 달리,
 * 닫은 투어가 브라우저를 다시 열 때마다 또 뜨면 안내가 아니라 방해다.
 * 재실행은 헤더의 도움말(?) 버튼이 맡는다.
 */

const PREFIX = 'ocean.tour.v1'

/** 읽고 쓰는 데 필요한 최소 계약 — 테스트가 가짜 저장소를 끼울 수 있게 좁혀 둔다 */
export type TourStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function tourStorageKey(tourId: string): string {
  return `${PREFIX}:${tourId}`
}

export function isTourSeen(storage: TourStorage | null | undefined, tourId: string): boolean {
  if (!storage) return false
  try {
    return storage.getItem(tourStorageKey(tourId)) === 'done'
  } catch {
    /* 사생활 보호 모드 — 기억을 못 읽으면 안 본 것으로 친다(한 번 더 뜨는 쪽이 낫다) */
    return false
  }
}

export function markTourSeen(storage: TourStorage | null | undefined, tourId: string): void {
  if (!storage) return
  try {
    storage.setItem(tourStorageKey(tourId), 'done')
  } catch {
    /* 저장 실패 — 이번 세션에는 다시 안 뜨고, 다음 방문에 또 뜰 뿐이다 */
  }
}

/** 브라우저가 아니거나 접근이 막힌 환경에서는 null — 호출부가 분기하지 않게 한다 */
export function localStorageOrNull(): TourStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}
