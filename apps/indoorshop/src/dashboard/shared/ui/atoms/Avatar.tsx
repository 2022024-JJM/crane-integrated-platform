import { cn } from '../../lib/utils'
import { getInitials } from '../../config/currentUser'

/**
 * 사용자 아바타.
 *
 * 사진이 없으므로 이니셜을 쓴다. 브랜드 타일(각진 사각형)과 달리 원형이다 —
 * "제품"과 "사람"이 같은 모양을 쓰면 툴바에서 둘이 구분되지 않는다.
 */
export type AvatarSize = 'sm' | 'md' | 'lg'

const sizeConfig: Record<AvatarSize, { box: string; text: string }> = {
  sm: { box: 'h-7 w-7', text: 'text-2xs' },
  md: { box: 'h-9 w-9', text: 'text-inshop-xs' },
  lg: { box: 'h-11 w-11', text: 'text-inshop-sm' },
}

interface AvatarProps {
  name: string
  size?: AvatarSize
  className?: string
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const { box, text } = sizeConfig[size]

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-accent font-semibold tracking-[-0.01em] text-on-accent',
        box,
        text,
        className,
      )}
    >
      {getInitials(name)}
    </span>
  )
}
