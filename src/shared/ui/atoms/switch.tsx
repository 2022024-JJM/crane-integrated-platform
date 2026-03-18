import { cn } from '@/shared/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

function Switch({
  checked,
  onCheckedChange,
  className,
  disabled = false,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50',
        checked ? 'border-blue-600 bg-blue-600' : 'border-border bg-muted',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[1.15rem]' : 'translate-x-[0.18rem]',
        )}
      />
    </button>
  );
}

export { Switch };
