import { cn } from '../../lib/utils'

/** ref 를 그대로 받는다 — 목록에서 특정 카드를 화면 안으로 스크롤할 때 쓴다 */
interface CardProps extends React.ComponentPropsWithRef<'div'> {
  /** 클릭 가능한 카드에만 호버 강조를 준다 */
  interactive?: boolean
}

/**
 * 표면 카드.
 *
 * 호버에 강조색 글로우를 주지 않는다 — 정보를 보는 카드에까지 강조가 붙으면
 * 화면 전체가 반응하는 것처럼 보여 정작 눌러야 할 것이 묻힌다.
 */
export function Card({ className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-inshop-lg border border-border bg-surface p-5 transition-colors duration-150',
        interactive && 'hover:border-accent/40 hover:bg-surface-secondary/30',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3.5', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex gap-2', className)} {...props} />
}

/**
 * 섹션 제목.
 *
 * 굵은 좌측 바 대신 크기·색으로 위계를 만든다. 바를 쓰면 강조색이 화면 곳곳에
 * 반복되면서 정작 강조여야 할 링크·활성 표시의 힘이 빠진다.
 */
export function SectionHeading({
  children,
  description,
  action,
  className,
}: {
  children: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-inshop-base font-semibold text-foreground">{children}</h2>
        {description && <p className="mt-0.5 text-inshop-xs text-foreground/58">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
