import { Select as SelectPrimitive } from '@base-ui/react';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@crane/core/lib/utils';
import { usePortalContainer } from './portal-container';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Select(props: SelectPrimitive.Root.Props<any>) {
  return <SelectPrimitive.Root {...props} />;
}

type SelectTriggerVariant = 'default' | 'ghost';

interface SelectTriggerProps extends SelectPrimitive.Trigger.Props {
  label?: string;
  /**
   * `default` 는 테두리 있는 입력 필드 모양. `ghost` 는 도구 모음의 고스트
   * 아이콘 버튼(`Button variant="ghost"`)과 같은 언어 — 테두리·배경 없이
   * 텍스트만 두고 hover·열림 시에만 `bg-muted` 가 뜬다. 색·hover 값은
   * 버튼 ghost variant 와 같은 토큰을 쓴다.
   */
  variant?: SelectTriggerVariant;
}

const SELECT_TRIGGER_VARIANT_CLASS: Record<SelectTriggerVariant, string> = {
  default: 'border-border bg-background hover:bg-muted',
  ghost:
    'border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground dark:hover:bg-muted/50',
};

/**
 * 표시 우선순위: children > label > 선택값 텍스트. children 은 아이콘처럼
 * 문자열이 아닌 표시가 필요할 때 쓴다.
 */
function SelectTrigger({
  className,
  label,
  variant = 'default',
  children,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'focus-visible:border-ring focus-visible:ring-ring/50 flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
        SELECT_TRIGGER_VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    >
      {children !== undefined ? (
        children
      ) : label !== undefined ? (
        <span>{label}</span>
      ) : (
        <SelectPrimitive.Value />
      )}
      {/* ghost 는 부모 글자색을 따라 hover 시 라벨과 함께 진해진다. */}
      <ChevronDown
        className={cn(
          'size-3 shrink-0',
          variant === 'ghost' ? 'text-current' : 'text-muted-foreground',
        )}
      />
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
  // 전체화면 루트가 컨테이너를 제공하면 그 안으로, 아니면 기존대로 body.
  const portalContainer = usePortalContainer();

  return (
    <SelectPrimitive.Portal
      container={
        portalContainer ??
        (typeof document !== 'undefined' ? document.body : undefined)
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
