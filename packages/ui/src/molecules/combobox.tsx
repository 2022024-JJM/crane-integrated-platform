import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { Check, ChevronDown, Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@crane/core/lib/utils';
import { usePortalContainer } from './portal-container';

/**
 * 검색 가능한 단일 선택 콤보박스 — Select 처럼 트리거 버튼을 누르면 팝업이
 * 열리고, 팝업 안의 검색 입력으로 목록을 거른다. 자유 입력은 받지 않는다
 * (값은 항상 options 중 하나이거나 null).
 *
 * base-ui Combobox 를 감싼다. 팝업은 Select/Popover 와 같은 규약 —
 * usePortalContainer() 로 3D 전체화면 루트 안에 포털하고 z-9999.
 */
export interface ComboboxOption {
  value: string;
  label: string;
  /** 라벨 아래 보조 설명(단위·범위 등). */
  description?: string;
  /** 라벨 우측 작은 배지(소스 구분 등). */
  badge?: string;
  disabled?: boolean;
}

export interface ComboboxItemState {
  selected: boolean;
}

export interface ComboboxProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: readonly ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** 트리거 버튼 클래스. */
  className?: string;
  /** 트리거 표시를 직접 그린다(기본은 선택 항목 라벨). */
  renderValue?: (option: ComboboxOption | null) => ReactNode;
  'aria-label'?: string;
  /** 현재 값이 유효하지 않음을 시각적으로 알린다(amber 테두리). */
  invalid?: boolean;
  popupClassName?: string;
  /**
   * 하이라이트된 항목(마우스 호버·키보드 이동)이 바뀔 때 — 항목 밖으로 나가면
   * null. 인스펙터 노드 선택기가 미리보기에 쓴다.
   */
  onHighlightChange?: (value: string | null) => void;
  /** 팝업 열림·닫힘. */
  onOpenChange?: (open: boolean) => void;
  /**
   * 행 내용을 직접 그린다(기본은 체크 표시 + 라벨 + 배지 + 설명). 트리 모양
   * 목록(인스펙터 노드 선택기)이 쓴다.
   */
  renderItem?: (option: ComboboxOption, state: ComboboxItemState) => ReactNode;
  /** 행 클래스 — renderItem 으로 안쪽 여백을 직접 잡을 때 기본 px/py 를 덮는다. */
  itemClassName?: string;
  /** 검색에 쓸 글자(기본은 라벨 + 값 + 설명). */
  searchText?: (option: ComboboxOption) => string;
  /**
   * 검색어 변화. 검색어가 비면 base-ui 가 filter 를 부르지 않으므로, 접힌
   * 행을 빼는 식의 목록 변화는 options 자체로 해야 한다 — 그때 쓴다.
   */
  onSearchChange?: (query: string) => void;
}

function optionText(option: ComboboxOption): string {
  return `${option.label} ${option.value} ${option.description ?? ''}`;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  className,
  renderValue,
  invalid,
  popupClassName,
  onHighlightChange,
  onOpenChange,
  renderItem,
  itemClassName,
  searchText,
  onSearchChange,
  'aria-label': ariaLabel,
}: ComboboxProps) {
  const portalContainer = usePortalContainer();
  const { contains } = ComboboxPrimitive.useFilter({ sensitivity: 'base' });
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <ComboboxPrimitive.Root<ComboboxOption>
      items={options}
      value={selected}
      onValueChange={(next) => onValueChange(next ? next.value : null)}
      itemToStringLabel={(o) => o.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={(item, query) => contains(item, query, searchText ?? optionText)}
      disabled={disabled}
      modal={false}
      onItemHighlighted={(item) =>
        onHighlightChange?.(item ? item.value : null)
      }
      onOpenChange={(open) => onOpenChange?.(open)}
      onInputValueChange={(inputValue) => onSearchChange?.(inputValue)}
    >
      <ComboboxPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          'border-border bg-muted hover:bg-muted/70 focus-visible:border-ring focus-visible:ring-ring/50 flex h-7 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
          invalid && 'border-amber-500 text-amber-500',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {renderValue ? (
            renderValue(selected)
          ) : selected ? (
            selected.label
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="text-muted-foreground size-3 shrink-0" />
      </ComboboxPrimitive.Trigger>
      <ComboboxPrimitive.Portal
        container={
          portalContainer ??
          (typeof document !== 'undefined' ? document.body : undefined)
        }
      >
        <ComboboxPrimitive.Positioner
          sideOffset={4}
          align="start"
          collisionPadding={8}
          className="z-9999"
        >
          <ComboboxPrimitive.Popup
            className={cn(
              'border-border bg-popover text-popover-foreground flex w-[var(--anchor-width)] min-w-56 flex-col overflow-hidden rounded-md border shadow-md',
              'origin-[var(--transform-origin)] transition-[transform,scale,opacity]',
              'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
              'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
              popupClassName,
            )}
          >
            <div className="border-border flex items-center gap-1.5 border-b px-2">
              <Search className="text-muted-foreground size-3 shrink-0" />
              <ComboboxPrimitive.Input
                placeholder={searchPlaceholder}
                className="placeholder:text-muted-foreground h-7 w-full min-w-0 bg-transparent text-xs outline-none"
              />
            </div>
            <ComboboxPrimitive.Empty className="text-muted-foreground px-2 py-2 text-xs empty:hidden">
              {emptyText}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="max-h-64 overflow-y-auto p-1 empty:hidden">
              {(item: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  disabled={item.disabled}
                  className={cn(
                    'relative flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors outline-none',
                    'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                    itemClassName,
                  )}
                >
                  {renderItem ? (
                    renderItem(item, { selected: item.value === value })
                  ) : (
                    <>
                      <ComboboxPrimitive.ItemIndicator className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
                        <Check className="size-3" />
                      </ComboboxPrimitive.ItemIndicator>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate">{item.label}</span>
                          {item.badge ? (
                            <span className="text-muted-foreground border-border shrink-0 rounded border px-1 text-[9px] uppercase">
                              {item.badge}
                            </span>
                          ) : null}
                        </span>
                        {item.description ? (
                          <span className="text-muted-foreground truncate text-[10px]">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                    </>
                  )}
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}
