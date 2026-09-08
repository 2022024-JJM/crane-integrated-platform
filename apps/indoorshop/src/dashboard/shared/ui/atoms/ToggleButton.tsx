import { cn } from '../../lib/utils'

interface ToggleButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  /** 유리 패널(3D 뷰포트 위) 바탕에 설 때 — 자세한 이유는 Segmented 의 같은 prop 참조 */
  tone?: 'surface' | 'glass'
}

export function ToggleButton({
  pressed,
  onPressedChange,
  tone = 'surface',
  className,
  onClick,
  ...props
}: ToggleButtonProps) {
  const glass = tone === 'glass'

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
        'focus:outline-none focus-visible:ring-2',
        glass
          ? 'focus-visible:ring-glass-accent'
          : 'focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        glass
          ? pressed
            ? 'border-glass-accent/60 bg-glass-active text-glass-accent'
            : 'border-glass-border/70 text-glass-foreground/63 hover:text-glass-foreground'
          : pressed
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-border text-foreground/68 hover:text-foreground',
        className,
      )}
      {...props}
    />
  )
}
