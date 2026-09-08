import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

/**
 * 버튼 표면.
 *
 * - `solid`   주 동작 하나. accent 채움 + on-accent 잉크(대비 검증됨)
 * - `outline` 카드 안의 이동 링크 등 부차 동작
 * - `ghost`   툴바·아이콘 옆 등 배경 없는 동작
 */
export type ButtonVariant = 'solid' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const variantClass: Record<ButtonVariant, string> = {
  solid: 'bg-accent text-on-accent hover:bg-accent/90',
  outline: 'border border-border text-foreground hover:border-accent/50 hover:bg-accent/8 hover:text-accent',
  ghost: 'text-foreground/70 hover:bg-surface-secondary hover:text-foreground',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-inshop-xs',
  md: 'h-9 px-4 text-inshop-sm',
}

const base = cn(
  'inline-flex items-center justify-center gap-1.5 rounded-inshop-md font-medium',
  'transition-colors duration-150',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:pointer-events-none disabled:opacity-50',
)

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

export function Button({
  variant = 'outline',
  size = 'md',
  className,
  type = 'button',
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(base, variantClass[variant], sizeClass[size], className)}
      {...props}
    />
  )
}

/** 라우터 이동용 — 버튼과 같은 표면을 쓴다 */
export function LinkButton({
  variant = 'outline',
  size = 'md',
  className,
  to,
  ...props
}: CommonProps & { to: string } & Omit<React.ComponentProps<typeof Link>, 'to' | 'className'>) {
  return (
    <Link
      to={to}
      className={cn(base, variantClass[variant], sizeClass[size], className)}
      {...props}
    />
  )
}
