import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getComponentsByCraneId } from '@crane/domain/asset';
import { cn } from '@crane/core/lib/utils';
import { inputClass } from './form-helpers';
import { FOCUS_RING } from '../../../shared/ui/controls';

interface ComponentComboboxProps {
  craneId: string;
  value: string;
  onValueChange: (v: string) => void;
  // FormField가 cloneElement로 주입하는 접근성 props — 내부 input으로 전달한다.
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  required?: boolean;
}

const MAX_SUGGESTIONS = 15;

/**
 * 구성품 자유입력 겸용 자동완성 — 크레인 선택 시 해당 크레인의 구성품
 * 마스터(클러스터/BOM 품목)에서 제안하고, 목록에 없는 이름도 그대로 입력 가능.
 */
export function ComponentCombobox({
  craneId,
  value,
  onValueChange,
  ...fieldProps
}: ComponentComboboxProps) {
  const { t } = useTranslation('ticket');
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const components = useMemo(
    () => (craneId ? getComponentsByCraneId(craneId) : []),
    [craneId],
  );

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) {
      // 빈 쿼리 = 상위 클러스터(부품 그룹)만 노출 — 306개 전체를 쏟아내지 않는다
      return components.filter((c) => c.parentId === null);
    }
    return components
      .filter(
        (c) =>
          c.componentName.toLowerCase().includes(q) ||
          c.partNumber?.toLowerCase().includes(q),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [components, value]);

  const disabled = !craneId;

  return (
    <div className="relative">
      <input
        {...fieldProps}
        className={inputClass}
        value={value}
        disabled={disabled}
        placeholder={
          disabled ? t('placeholders.componentNeedsCrane') : t('placeholders.componentName')
        }
        autoComplete="off"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md"
        >
          {suggestions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                // onMouseDown: input blur보다 먼저 실행되어 선택이 씹히지 않는다
                onMouseDown={(e) => {
                  e.preventDefault();
                  onValueChange(c.componentName);
                  setOpen(false);
                }}
                className={cn(FOCUS_RING, 
                  'flex w-full cursor-pointer items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/60',
                  c.parentId === null && 'font-medium',
                )}
              >
                <span className="truncate">{c.componentName}</span>
                {c.partNumber && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {c.partNumber}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
