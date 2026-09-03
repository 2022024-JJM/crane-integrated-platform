import { describe, expect, it } from 'vitest'
import {
  readRecentSearches,
  rememberRecentSearch,
  RECENT_LIMIT,
  type RecentSearch,
} from '../lib/recentSearches'

/*
 * 최근 검색 저장 규칙 — node 환경이라 진짜 sessionStorage 가 없으므로 같은 표면의
 * 가짜를 쓴다. 모듈이 Storage 를 주입받게 되어 있는 이유가 이 테스트다.
 */

function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  }
}

const pick = (title: string, href: string): RecentSearch => ({
  group: 'block',
  title,
  subtitle: null,
  href,
})

describe('최근 검색', () => {
  it('최신이 앞, 상한 3건', () => {
    const storage = fakeStorage()
    for (const n of ['1', '2', '3', '4']) rememberRecentSearch(pick(n, `/p?${n}`), storage)
    const list = readRecentSearches(storage)
    expect(list.map((item) => item.title)).toEqual(['4', '3', '2'])
    expect(list.length).toBe(RECENT_LIMIT)
  })

  it('같은 곳(href)을 다시 고르면 중복 대신 맨 앞으로 올라온다', () => {
    const storage = fakeStorage()
    rememberRecentSearch(pick('a', '/p?a'), storage)
    rememberRecentSearch(pick('b', '/p?b'), storage)
    rememberRecentSearch(pick('a', '/p?a'), storage)
    expect(readRecentSearches(storage).map((item) => item.title)).toEqual(['a', 'b'])
  })

  it('깨진 저장값은 빈 목록으로 — 오류가 화면까지 오지 않는다', () => {
    const storage = fakeStorage()
    storage.setItem('global-search:recent', '{억지로 깨뜨린 JSON')
    expect(readRecentSearches(storage)).toEqual([])
    storage.setItem('global-search:recent', JSON.stringify([{ nope: true }, pick('ok', '/p')]))
    expect(readRecentSearches(storage).map((item) => item.title)).toEqual(['ok'])
  })

  it('저장소가 아예 없어도(사생활 보호 모드) 조용히 빈 목록이다', () => {
    expect(readRecentSearches(null)).toEqual([])
    expect(rememberRecentSearch(pick('a', '/p?a'), null).map((i) => i.title)).toEqual(['a'])
  })
})
