import { Select as SelectPrimitive } from '@base-ui/react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

function Select(props: SelectPrimitive.Root.Props) {
  return <SelectPrimitive.Root {...props} />;
}

interface SelectTriggerProps extends SelectPrimitive.Trigger.Props {
  label?: string;
}

function SelectTrigger({
  className,
  label,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {label !== undefined ? (
        <span>{label}</span>
      ) : (
        <SelectPrimitive.Value />
      )}
      <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
    </SelectPrimitive.Trigger>
  );
}

function SelectPopup({ className, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={4} align="start">
        <SelectPrimitive.Popup
          className={cn(
            'z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
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
        'relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none transition-colors',
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
