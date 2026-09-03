import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MATCH_TOLERANCE_DEFAULT_CM,
  MATCH_TOLERANCE_MAX_CM,
  MATCH_TOLERANCE_MIN_CM,
  clampToleranceCm,
  getMatchToleranceCm,
  resetMatchToleranceForTest,
  setMatchToleranceCm,
  subscribeMatchTolerance,
} from '../matchTolerance'

/**
 * **실측 정합 판정 임계 — 설정이 임자, 뷰어는 구독** (R23).
 *
 * 이 값은 화면마다 따로 잡는 손잡이가 아니라 한 번 정해 두고 쓰는 판정 기준이다.
 * 저장이 안 되거나 구독이 안 오면 설정 화면에서 바꿔도 뷰어가 옛 숫자를 계속 말한다 —
 * 그 조용한 어긋남을 여기서 막는다.
 *
 * 파일이 `.tsx` 인 것은 **환경 때문**이다 — 이 레포는 확장자로 테스트 환경을 가르고
 * (`vite.config.ts`), localStorage 는 jsdom 쪽에만 있다.
 */
describe('범위 — 5 ~ 60cm', () => {
  it('상수가 스펙 그대로다 (자산 재생성으로 60cm 까지 열렸다)', () => {
    expect(MATCH_TOLERANCE_MIN_CM).toBe(5)
    expect(MATCH_TOLERANCE_MAX_CM).toBe(60)
    expect(MATCH_TOLERANCE_DEFAULT_CM).toBeGreaterThanOrEqual(MATCH_TOLERANCE_MIN_CM)
    expect(MATCH_TOLERANCE_DEFAULT_CM).toBeLessThanOrEqual(MATCH_TOLERANCE_MAX_CM)
  })

  it('범위 밖·비수치는 조여 받는다 — 손으로 고친 저장값이 화면을 깨뜨리지 않게', () => {
    expect(clampToleranceCm(3)).toBe(5)
    expect(clampToleranceCm(999)).toBe(60)
    expect(clampToleranceCm('20')).toBe(20)
    expect(clampToleranceCm(20.4)).toBe(20)
    expect(clampToleranceCm('abc')).toBe(MATCH_TOLERANCE_DEFAULT_CM)
    /* 값이 없는 것은 하한이 아니라 기본값이다 — Number(null)===0 에 걸려들지 않게 */
    expect(clampToleranceCm(null)).toBe(MATCH_TOLERANCE_DEFAULT_CM)
    expect(clampToleranceCm(undefined)).toBe(MATCH_TOLERANCE_DEFAULT_CM)
    expect(clampToleranceCm('')).toBe(MATCH_TOLERANCE_DEFAULT_CM)
  })
})

describe('저장 → 구독 반영', () => {
  beforeEach(() => resetMatchToleranceForTest())
  afterEach(() => resetMatchToleranceForTest())

  it('바꾸면 구독자에게 알리고 값이 남는다 (설정 저장 → 뷰어 반영)', () => {
    const seen: number[] = []
    const stop = subscribeMatchTolerance(() => seen.push(getMatchToleranceCm()))

    setMatchToleranceCm(45)
    expect(getMatchToleranceCm()).toBe(45)
    expect(seen).toEqual([45])

    setMatchToleranceCm(60)
    expect(seen).toEqual([45, 60])

    stop()
    setMatchToleranceCm(10)
    /* 해지 뒤에는 안 온다 — 떠난 화면이 계속 깨어나지 않게 */
    expect(seen).toEqual([45, 60])
    expect(getMatchToleranceCm()).toBe(10)
  })

  it('같은 값으로 다시 넣으면 알리지 않는다 (불필요한 재채색 방지)', () => {
    let calls = 0
    const stop = subscribeMatchTolerance(() => calls++)
    /* 기본값과 다른 값으로 한 번 바꾸고, 같은 값을 한 번 더 */
    setMatchToleranceCm(25)
    setMatchToleranceCm(25)
    stop()
    expect(calls).toBe(1)
  })

  it('저장한 값이 스토리지에 남는다 — 새로고침·다른 화면에서도 같은 기준', () => {
    /* 이 환경엔 실제 localStorage 가 아예 없다(setupDom 이 `?.` 로 참조하는 이유) —
       그래서 전역을 통째로 갈아 끼워 "무엇을 어떤 키로 저장하는가" 만 본다 */
    const store = new Map<string, string>()
    const fake = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true })

    setMatchToleranceCm(12)
    expect(store.get('real-scan-match-tolerance-cm')).toBe('12')

    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it('스토리지가 없는 환경에서도 값은 살아 있다 (이 테스트 환경이 바로 그 경우다)', () => {
    setMatchToleranceCm(40)
    expect(getMatchToleranceCm()).toBe(40)
  })

  it('스토리지가 막혀 있어도 이번 세션은 동작한다', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    expect(() => setMatchToleranceCm(55)).not.toThrow()
    expect(getMatchToleranceCm()).toBe(55)
    spy.mockRestore()
  })
})
