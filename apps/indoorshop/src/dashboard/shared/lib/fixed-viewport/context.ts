import { createContext } from 'react'

/**
 * "화면에 딱 맞는" 페이지 모드.
 *
 * 모니터링 화면은 문서가 아니라 계기판이다 — 스크롤해서 찾아야 하는 값은
 * 현장에서 아무도 보지 않는다. 이 모드에서는 셸(툴바 아래 본문)이 뷰포트 높이에
 * 고정되고, 넘치는 내용은 페이지가 아니라 **각 패널이 안에서** 스크롤한다.
 *
 * 좁은 화면(xl 미만)에서는 칸을 나눌 자리가 없으므로 적용하지 않는다 —
 * 그래서 셸도 페이지도 고정 규칙에는 `xl:` 접두사만 쓴다.
 */
export interface FixedViewportContextType {
  fixed: boolean
  setFixed: (value: boolean) => void
}

export const FixedViewportContext = createContext<FixedViewportContextType>({
  fixed: false,
  setFixed: () => {},
})
