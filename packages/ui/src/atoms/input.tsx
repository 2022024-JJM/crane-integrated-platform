import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
} from 'react';
import { cn } from '@crane/core/lib/utils';

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
        'border-border bg-background focus:border-ring focus:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm transition-colors outline-none focus:ring-3 disabled:pointer-events-none disabled:opacity-50',
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
