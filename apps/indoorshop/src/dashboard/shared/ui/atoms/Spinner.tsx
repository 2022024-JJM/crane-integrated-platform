import { cn } from '../../lib/utils'

interface SpinnerProps {
  size?: number
  /** 스크린리더가 읽을 문구 — 무엇을 기다리는 중인지 */
  label?: string
  className?: string
}

/**
 * 로딩 표시.
 *
 * 글자("불러오는 중…")는 자리를 차지하면서도 진행 중이라는 느낌을 주지 못한다.
 * 색은 currentColor 를 따르므로 놓이는 자리의 잉크를 그대로 쓴다.
 * 모션 저감 설정에서는 돌지 않고 정지한 링으로 남는다.
 */
export function Spinner({ size = 20, label = '불러오는 중', className }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="motion-safe:animate-spin"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

interface SpinnerOverlayProps {
  /** 감싼 영역 위에 덮는다 — 부모에 relative 가 있어야 한다 */
  label?: string
  className?: string
}

/**
 * 이미 그려진 내용 위에 덮는 로딩 막.
 *
 * 내용을 지우고 스피너로 갈아끼우면 레이아웃이 무너졌다가 돌아오면서 화면이 깜박인다.
 * 그래서 **이전 내용을 그대로 둔 채** 그 위에 얇게 덮는다.
 */
export function SpinnerOverlay({ label, className }: SpinnerOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex items-center justify-center rounded-inshop-lg',
        'animate-fade-in bg-background/45 backdrop-blur-[1px]',
        className,
      )}
    >
      <Spinner size={26} label={label} className="text-accent" />
    </div>
  )
}
