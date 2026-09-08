import { useContext, useLayoutEffect } from 'react'
import { FixedViewportContext } from './context'

/**
 * 페이지가 렌더하는 표식 — 이 화면은 뷰포트에 고정된다.
 *
 * 언마운트되면 자동으로 문서형으로 돌아가므로, 페이지 쪽에서 해제를 잊어
 * 다른 화면까지 잘리는 일이 없다.
 */
export function FixedViewport() {
  const { setFixed } = useContext(FixedViewportContext)

  /*
   * useLayoutEffect 인 이유: 셸 ScrollArea 안에서는 이 플래그가 서기 전의 첫 레이아웃이
   * 높이 제약 없이 계산된다. 그 한 프레임 동안 `xl:h-full` 사슬이 auto 로 풀려 캔버스
   * 컨테이너가 캔버스 자신의 크기를 따라 수만 px 로 자라고(ResizeObserver 되먹임),
   * 그 크기의 드로잉 버퍼를 한 번 할당했다가 버린다 — 첫 진입이 1초 넘게 멎는다.
   * 페인트 전에 플래그를 세우면 그 레이아웃은 아예 만들어지지 않는다.
   */
  useLayoutEffect(() => {
    setFixed(true)
    return () => setFixed(false)
  }, [setFixed])

  return null
}
