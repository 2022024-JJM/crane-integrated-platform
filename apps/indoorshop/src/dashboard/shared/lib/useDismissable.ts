import { useEffect, type RefObject } from 'react'

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
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onDismiss()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
