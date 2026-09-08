import { cn } from '../../lib/utils'

/**
 * 아이콘만 있는 동작 버튼 (툴바용).
 *
 * 라벨이 없으므로 `aria-label` 은 필수다 — 타입으로 강제한다.
 * 눌린 상태(`active`)는 배경으로만 낸다: 툴바에 강조색 아이콘이 여러 개 켜지면
 * 정작 강조여야 할 알림 배지가 묻힌다.
 */
interface IconButtonProps extends React.ComponentPropsWithRef<'button'> {
  'aria-label': string
  active?: boolean
}

export function IconButton({
  className,
  active = false,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        // 툴바의 모든 조작은 같은 36px 정사각형 — 낱개 크기가 다르면 줄이 안 맞는다
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-inshop-md transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        active
          ? 'bg-foreground/10 text-foreground'
          : 'text-foreground/68 hover:bg-foreground/8 hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}
