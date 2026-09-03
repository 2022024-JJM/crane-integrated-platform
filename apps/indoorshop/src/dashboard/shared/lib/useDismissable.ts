import { useEffect, type RefObject } from 'react'
import { useEscapeClaim } from './escapeClaims'

/**
 * 열린 오버레이(메뉴·팝오버)를 바깥 클릭과 ESC 로 닫는다.
 *
 * 계정 메뉴와 알림 메뉴가 같은 규칙으로 닫혀야 한다 — 한쪽만 ESC 가 먹으면
 * 사용자는 그것을 기능 차이가 아니라 고장으로 읽는다.
 */
export function useDismissable(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  /** 닫은 뒤 포커스를 돌려줄 트리거 */
  triggerRef?: RefObject<HTMLElement | null>
): void {
  /* 열려 있는 동안 ESC 우선권을 쥔다 — 리스너 순서와 무관하게 드릴다운 ESC 를 멈춘다 */
  useEscapeClaim(open)
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onDismiss()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        /* 이 ESC 는 여기서 소비됐다 — 뒤의 드릴다운 ESC 가 같이 움직이지 않게 */
        event.preventDefault()
        onDismiss()
        triggerRef?.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, containerRef, onDismiss, triggerRef])
}
