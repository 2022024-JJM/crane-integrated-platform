import { Select as SelectPrimitive } from '@base-ui/react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@crane/core/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Select(props: SelectPrimitive.Root.Props<any>) {
  return <SelectPrimitive.Root {...props} />;
}

interface SelectTriggerProps extends SelectPrimitive.Trigger.Props {
  label?: string;
}

function SelectTrigger({ className, label, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {label !== undefined ? <span>{label}</span> : <SelectPrimitive.Value />}
      <ChevronDown className="text-muted-foreground size-3 shrink-0" />
    </SelectPrimitive.Trigger>
  );
}

type SelectPopupProps = SelectPrimitive.Popup.Props & {
  align?: SelectPrimitive.Positioner.Props['align'];
};

function SelectPopup({
  className,
  align = 'start',
  ...props
}: SelectPopupProps) {
  return (
    <SelectPrimitive.Portal
      container={
        typeof document !== 'undefined' ? document.body : undefined
      }
    >
      <SelectPrimitive.Positioner
        sideOffset={4}
        align={align}
        collisionPadding={8}
        alignItemWithTrigger={false}
        className="z-9999"
      >
        <SelectPrimitive.Popup
          className={cn(
            'border-border bg-popover text-popover-foreground min-w-32 overflow-hidden rounded-md border p-1 shadow-md',
            'origin-[var(--transform-origin)] transition-[transform,scale,opacity]',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            className,
          )}
          {...props}
        />
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="flex size-3.5 items-center justify-center">
        <Check className="size-3" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectTrigger, SelectPopup, SelectItem };
