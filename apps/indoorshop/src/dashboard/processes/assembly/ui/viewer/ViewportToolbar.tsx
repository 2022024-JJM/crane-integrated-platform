import type { ReactNode } from 'react'
import { cn } from '../../../../shared/lib/utils'

interface ViewportToolbarProps {
  /** 이 뷰포트가 무엇을 그리고 있는지 — 화면의 소제목이 여기로 들어온다 */
  title: string
  /** 한 줄 안내 — 없으면 제목만 선다 */
  hint?: string
  /**
   * 무엇을 볼지 고르는 줄 — 이 화면에서는 정반 칩. 제목 위에 선다.
   * (공장 전환은 3D 상자 **위에 붙은 탭**이 맡는다 — AssemblyLocationTabs 의 `attached`.)
   */
  nav?: ReactNode
  children?: ReactNode
  className?: string
}

/**
 * 3D 뷰포트 **왼쪽 위**에 뜨는 유리 도구줄.
 *
 * 제목·안내·표시 옵션·전환 탭을 뷰포트 바깥 위에 쌓으면 그만큼 3D 의 세로가 잘린다 —
 * 이 화면에서 세로는 곧 뷰어의 시야다. 그래서 도구를 뷰포트 안으로 들여 겹쳐 띄우고,
 * 3D 는 칸의 높이를 통째로 쓴다.
 *
 * 자리는 **왼쪽 위**다. 가운데로 띄우면 화면이 좁아질수록 판이 양쪽으로 자라
 * 왼쪽 위 범례를 덮는데, 얼마나 덮을지가 폭에 따라 달라져 어느 쪽도 자리를 못 잡는다.
 * 왼쪽 위에 붙이면 판은 오른쪽으로만 자라고, 범례는 오른쪽 위로 한 번만 비키면 된다
 * (그 자리는 실측 뷰어가 블록 상세를 띄울 때 이미 쓰던 자리와 같다).
 */
export function ViewportToolbar({ title, hint, nav, children, className }: ViewportToolbarProps) {
  return (
    <div
      className={cn(
        // 폭은 오른쪽 위 도구(전체 화면 버튼)를 침범하지 않을 만큼까지만
        'absolute left-4 top-4 z-10 max-w-[calc(100%-5rem)]',
        'flex flex-col gap-2 rounded-inshop-lg glass-panel px-3 py-2',
        className,
      )}
    >
      {nav && <div className="min-w-0">{nav}</div>}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-2xs font-semibold uppercase tracking-wide text-glass-foreground/85">
          {title}
        </h2>
        {hint && <p className="text-2xs text-glass-foreground/54">{hint}</p>}
      </div>
      {children}
    </div>
  )
}
