import { Dialog as DialogPrimitive } from '@base-ui/react';
import { cn } from '@crane/core/lib/utils';
import { usePortalContainer } from './portal-container';

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />;
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger {...props} />;
}

/**
 * Portal + Backdrop + Popup 을 한 번에 렌더한다. AlertDialog 와 달리 백드롭
 * 클릭·ESC 로 닫힌다(Base UI 기본). 포털 컨테이너는 팝오버·툴팁과 같은 규약
 * (`usePortalContainer`)을 따라 전체화면 루트 안에서도 보인다.
 *
 * 기본 크기는 좁은 확인창(`max-w-sm`)이고, 넓은 작업창은 `className` 으로
 * `max-w-*`·높이를 준다.
 */
function DialogPopup({ className, ...props }: DialogPrimitive.Popup.Props) {
  const container = usePortalContainer();

  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Backdrop
        className={cn(
          'fixed inset-0 z-9999 bg-black/50 transition-opacity duration-150',
          'data-[ending-style]:opacity-0 data-[starting-style]:opacity-0',
        )}
      />
      <DialogPrimitive.Popup
        className={cn(
          'border-border bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-9999 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-lg outline-none',
          'transition-[transform,scale,opacity] duration-150',
          'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
          'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn('text-sm font-bold', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn('text-muted-foreground mt-2 text-xs', className)}
      {...props}
    />
  );
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close {...props} />;
}

export {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
