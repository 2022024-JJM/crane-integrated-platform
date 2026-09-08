import { useCallback, useSyncExternalStore } from 'react'

/**
 * CSS 미디어 쿼리를 React 값으로 읽는다.
 *
 * **DOM 을 다르게 짜야 할 때만** 쓴다 — 같은 것을 크게/작게, 보이게/숨기게 하는 일은
 * Tailwind 의 반응형 클래스가 낫다(자바스크립트가 뜨기 전 첫 페인트부터 맞는다).
 * 여기 필요한 것은 그보다 큰 결정이다: 예컨대 대시보드 지도는 넓은 화면에서 패널을
 * 지도 **위에** 겹치고, 좁은 화면에서는 지도 **아래**로 내려 문서처럼 스크롤한다 —
 * 부모가 달라지므로 클래스만으로는 표현할 수 없다.
 *
 * 서버 렌더/테스트 환경(matchMedia 없음)에서는 `false` 로 본다 — 좁은 화면 쪽이
 * 겹침 없이 스크롤하는 안전한 배치다.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const media = window.matchMedia(query)
      media.addEventListener('change', onStoreChange)
      return () => media.removeEventListener('change', onStoreChange)
    },
    [query]
  )

  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false),
    () => false
  )
}
