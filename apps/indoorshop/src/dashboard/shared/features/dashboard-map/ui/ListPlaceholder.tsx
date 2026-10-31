import type { ReactNode } from 'react'
import { cn } from '../../../lib/utils'

/**
 * 목록이 비었을 때 그 자리를 채우는 **플레이스홀더** — 점선 테두리 상자에 아이콘과 한 줄(사용자
 * 확정). 작은 회색 글씨 한 줄은 "아직 안 불러왔다"·"자리가 빠졌다"와 구분이 안 됐다 — 상자로
 * 자리를 지켜 "여기는 비어 있다"를 말한다. 베이 카드의 작업 목록·점검 필요가 함께 쓴다.
 */
export function ListPlaceholder({
  icon,
  children,
  className,
}: {
  icon: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-inshop-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-3 text-inshop-sm text-white/50',
        className
      )}
    >
      <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/45">
        {icon}
      </span>
      <span>{children}</span>
    </div>
  )
}

/** 빈 작업 목록 아이콘 — 빈 상자 */
export function EmptyBoxIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  )
}

/** 점검 필요 없음 아이콘 — 체크 */
export function AllClearIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
