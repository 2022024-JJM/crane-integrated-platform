import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react';
import { cn } from '@crane/core/lib/utils';

function AlertDialog(props: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root {...props} />;
}

function AlertDialogTrigger(props: AlertDialogPrimitive.Trigger.Props) {
  return <AlertDialogPrimitive.Trigger {...props} />;
}

/**
 * Portal + Backdrop + Popup 을 한 번에 렌더한다.
 * AlertDialog 는 백드롭 클릭으로 닫히지 않으므로(Base UI 기본), 닫는 경로는
 * 명시적 버튼(`AlertDialogClose` 또는 onOpenChange)과 ESC 뿐이다.
 */
function AlertDialogPopup({
  className,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop
        className={cn(
          'fixed inset-0 z-9999 bg-black/50 transition-opacity duration-150',
          'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
        )}
      />
      <AlertDialogPrimitive.Popup
        className={cn(
          'border-border bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-9999 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-lg outline-none',
          'transition-[transform,scale,opacity] duration-150',
          'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
          'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      className={cn('text-sm font-bold', className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-muted-foreground mt-2 text-xs', className)}
      {...props}
    />
  );
}

function AlertDialogClose(props: AlertDialogPrimitive.Close.Props) {
  return <AlertDialogPrimitive.Close {...props} />;
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
};
