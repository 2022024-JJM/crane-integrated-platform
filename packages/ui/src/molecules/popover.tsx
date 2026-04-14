import { Popover as PopoverPrimitive } from '@base-ui/react';
import { cn } from '@crane/core/lib/utils';

function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props} />;
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger {...props} />;
}

interface PopoverPopupProps extends PopoverPrimitive.Popup.Props {
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

function PopoverPopup({
  className,
  align = 'end',
  sideOffset = 8,
  ...props
}: PopoverPopupProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner align={align} sideOffset={sideOffset}>
        <PopoverPrimitive.Popup
          className={cn(
            'border-border bg-popover text-popover-foreground z-50 min-w-[8rem] overflow-hidden rounded-lg border p-1 shadow-lg',
            'origin-[var(--transform-origin)] transition-[transform,scale,opacity] duration-150',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverClose(props: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close {...props} />;
}

export { Popover, PopoverTrigger, PopoverPopup, PopoverClose };
