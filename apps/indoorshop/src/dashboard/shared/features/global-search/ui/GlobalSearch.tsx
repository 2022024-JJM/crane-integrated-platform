import { lazy, Suspense, useEffect, useState } from 'react'
import { isTypingTarget } from '../../../lib/useDrilldownEscape'
import { onGlobalSearchOpen } from '../lib/openBus'

/*
 * 통합 검색의 **상주 마운트** — 레이아웃에 한 번 서서 단축키와 열기 신호만 듣는다.
 *
 * 팔레트 본체(오버레이)는 lazy 다: 검색은 로스터·설비·통합실적 생성기를 끌고 오는데,
 * 그 무게를 팔레트를 한 번도 안 여는 사용자의 첫 화면에 실을 이유가 없다. 닫혀 있는
 * 동안 이 컴포넌트는 리스너 두 개짜리 빈 손이다.
 */

const GlobalSearchOverlay = lazy(() =>
  import('./GlobalSearchOverlay').then((m) => ({ default: m.GlobalSearchOverlay }))
)

export function GlobalSearch() {
  const [open, setOpen] = useState(false)

  /* 헤더 버튼(openGlobalSearch)이 두드리는 문 */
  useEffect(() => onGlobalSearchOpen(() => setOpen(true)), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      /* Cmd/Ctrl+K — 토글. 어디서든(입력창 안에서도) 먹는 팔레트의 표준 문법 */
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
        return
      }
      /*
       * '/' — 글자를 치는 중이 아닐 때만 연다. 판별은 드릴다운 ESC 와 같은 함수를
       * 쓴다(두 전역 단축키가 "입력 중"을 서로 다르게 재면 한쪽은 고장으로 읽힌다).
       */
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.defaultPrevented &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!open) return null
  return (
    <Suspense fallback={null}>
      <GlobalSearchOverlay onClose={() => setOpen(false)} />
    </Suspense>
  )
}
