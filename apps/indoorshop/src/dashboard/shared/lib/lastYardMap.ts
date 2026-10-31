import { useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'

/*
 * 야드 맵의 **마지막 자리** — 다른 화면에 갔다가 헤더의 '야드 맵' 을 누르면 대문(초기값)이
 * 아니라 마지막으로 보던 상태로 돌아온다(사용자 확정).
 *
 * 야드 맵의 상태는 주소가 정본이다(`?process=` `?factory=` `?bay=`, 검색 핀 `?vessel=` …).
 * 그래서 마지막 **쿼리**만 기억하면 선택이 그대로 돌아온다. 카메라(화각)는 주소에 없으므로
 * 지도 쪽이 따로 기억한다(`rememberYardCamera` — yard-map/lib/cameraHandoff).
 *
 * 탭 안에서만 산다(sessionStorage) — 새로고침해도 남고, 새 탭·다른 사람에게는 번지지 않는다.
 */

const STORAGE_KEY = 'otd:last-yard-map-search'
/** 야드 맵의 경로 — 내비게이션 항목의 path 와 같다 */
export const YARD_MAP_PATH = '/indoorshop'

function readStored(): string {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

let lastSearch: string = typeof window === 'undefined' ? '' : readStored()
const listeners = new Set<() => void>()

/** 야드 맵이 지금 주소의 쿼리(`?…` 또는 빈 문자열)를 맡긴다 */
export function rememberYardMapSearch(search: string): void {
  if (search === lastSearch) return
  lastSearch = search
  try {
    if (search) window.sessionStorage.setItem(STORAGE_KEY, search)
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 저장소를 못 쓰면 이 탭의 메모리로만 기억한다 */
  }
  for (const listener of listeners) listener()
}

/** 마지막으로 본 야드 맵 쿼리 */
export function lastYardMapSearch(): string {
  return lastSearch
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 내비게이션의 '야드 맵' 이 갈 주소 — 다른 화면에서는 마지막 상태(`/?factory=…`),
 * 야드 맵 위에서는 `/`(지금처럼 누르면 대문으로 돌아간다).
 */
export function useYardMapHref(): string {
  const { pathname } = useLocation()
  const search = useSyncExternalStore(subscribe, lastYardMapSearch, lastYardMapSearch)
  return pathname === YARD_MAP_PATH ? YARD_MAP_PATH : `${YARD_MAP_PATH}${search}`
}

/** 테스트 격리용 */
export function clearLastYardMap(): void {
  rememberYardMapSearch('')
}
