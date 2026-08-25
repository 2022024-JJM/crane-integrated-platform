import { cn } from '../../lib/utils'

interface ToggleButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
}

export function ToggleButton({
  pressed,
  onPressedChange,
  className,
  onClick,
  ...props
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onPressedChange(!pressed)
      }}
      className={cn(
        'shrink-0 rounded-inshop-md border px-3 py-1 text-inshop-xs font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        pressed
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border text-foreground/68 hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}
