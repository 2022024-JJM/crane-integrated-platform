import { useEffect, useState, type RefObject } from 'react'

/**
 * 요소가 화면(또는 그 언저리)에 들어와 있는지.
 *
 * 무거운 것을 **보이는 것만** 살려 두기 위한 스위치다 — 목록 카드마다 WebGL
 * 캔버스를 하나씩 띄우면 브라우저의 컨텍스트 한도(대개 16개)에 금방 닿고,
 * 보이지도 않는 캔버스가 매 프레임 렌더링하며 뷰어의 프레임을 갉아먹는다.
 *
 * `rootMargin` 만큼 미리 켜 두기 때문에, 스크롤해서 도착했을 때는 이미 살아 있다.
 */
export function useInViewport(
  ref: RefObject<HTMLElement | null>,
  rootMargin = '200px'
): boolean {
  const [inViewport, setInViewport] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // 지원하지 않는 환경(구형 WebView 등)에서는 항상 켠 것으로 본다
    if (typeof IntersectionObserver === 'undefined') {
      setInViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry.isIntersecting),
      { rootMargin }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, rootMargin])

  return inViewport
}
