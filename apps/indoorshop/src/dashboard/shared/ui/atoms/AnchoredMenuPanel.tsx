import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

interface AnchoredMenuPanelProps {
  /** 패널이 매달릴 트리거 — 이 사각형의 오른쪽 아래에 맞춘다 */
  anchorRef: RefObject<HTMLElement | null>
  /** 바깥 클릭 판정에 쓰인다 — 포털로 나간 패널은 트리거의 자손이 아니다 */
  panelRef: RefObject<HTMLDivElement | null>
  role: 'menu' | 'dialog'
  'aria-label'?: string
  className?: string
  children: ReactNode
}

/**
 * 헤더 메뉴(계정·알림)의 몸통.
 *
 * 헤더 안에 `absolute` 로 두면 헤더의 쌓임 맥락 안에 갇힌다. 그러면 페이지가 세운
 * sticky 툴바가 `backdrop-filter` 로 별도 합성 레이어가 되는 순간 — 설비 현황판의
 * 요약 스트립이 그렇다 — 브라우저에 따라 z 순서를 넘어 메뉴 위에 그려진다. 실제로
 * 계정 메뉴 아래쪽이 그 스트립에 잘려 보이는 화면이 나왔다.
 *
 * 그래서 패널만 `document.body` 로 내보내고 뷰포트 좌표로 세운다. 헤더 밖 최상위
 * 층(z-60)이므로 페이지가 무엇을 합성하든 그 위에 남는다.
 * 층 사다리: 페이지(≤30) < 헤더(40) < 드로어·모달(50) < **헤더 메뉴(60)** < 투어(70).
 */
export function AnchoredMenuPanel({
  anchorRef,
  panelRef,
  role,
  'aria-label': ariaLabel,
  className,
  children,
}: AnchoredMenuPanelProps) {
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const place = () => {
      const rect = anchor.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 6,
        // 트리거의 오른쪽 끝에 맞추되 창 밖으로 나가지 않게 한 뼘 남긴다
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }

    place()
    window.addEventListener('resize', place)
    /* 헤더는 sticky 라 제자리지만, 안쪽 스크롤 컨테이너가 움직이면 따라가야 한다 */
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchorRef])

  if (!position) return null

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-label={ariaLabel}
      style={{ top: position.top, right: position.right }}
      className={cn(
        'fixed z-[60] origin-top-right animate-fade-in rounded-inshop-lg',
        'bg-material-strong backdrop-blur-2xl backdrop-saturate-150 shadow-material',
        /* 짧은 화면에서 메뉴가 창 밖으로 흘러 나가지 않게 한다 */
        'max-h-[calc(100vh-4.5rem)] overflow-y-auto overflow-x-hidden',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}
