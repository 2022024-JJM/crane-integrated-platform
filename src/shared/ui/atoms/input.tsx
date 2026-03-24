import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
} from 'react';
import { cn } from '@/shared/lib/utils';

type InputProps = ComponentPropsWithoutRef<'input'>;

function InputBase(
  { className, type = 'text', ...props }: InputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

const Input = forwardRef(InputBase);

Input.displayName = 'Input';

export { Input };
export type { InputProps };
