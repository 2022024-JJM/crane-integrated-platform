import { cn } from '@crane/core/lib/utils';

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
        'focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border align-middle transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50',
        checked
          ? 'border-(--switch-on) bg-(--switch-on)'
          : 'border-border bg-muted',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[1.0625rem]' : 'translate-x-[0.1875rem]',
        )}
      />
    </button>
  );
}

export { Switch };
