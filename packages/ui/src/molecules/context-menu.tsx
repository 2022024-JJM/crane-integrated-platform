import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react';
import { cn } from '@crane/core/lib/utils';

function ContextMenu(props: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root {...props} />;
}

function ContextMenuTrigger(props: ContextMenuPrimitive.Trigger.Props) {
  return <ContextMenuPrimitive.Trigger {...props} />;
}

function ContextMenuPopup({
  className,
  ...props
}: ContextMenuPrimitive.Popup.Props) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="z-9999">
        <ContextMenuPrimitive.Popup
          className={cn(
            'border-border bg-popover text-popover-foreground min-w-32 overflow-hidden rounded-lg border p-1 shadow-lg',
            'origin-[var(--transform-origin)] transition-[transform,scale,opacity] duration-150',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            className,
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  ...props
}: ContextMenuPrimitive.Item.Props) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors outline-none',
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { ContextMenu, ContextMenuTrigger, ContextMenuPopup, ContextMenuItem };
