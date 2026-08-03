import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InventoryItem } from '@crane/domain/inventory';
import { cn } from '@crane/core/lib/utils';
import { inputClass } from './form';

const MAX_RESULTS = 20;

function displayLabel(item: InventoryItem): string {
  return `${item.partName} (${item.partNumber})`;
}

interface PartComboboxProps {
  items: InventoryItem[];
  /** 선택된 partId ('' = 미선택) — 자유 텍스트 불허, 선택으로만 값이 정해진다 */
  value: string;
  onSelect: (partId: string) => void;
  /** 가용 재고를 옵션 우측에 표시 (출고·부품 기록 등 재고 차감 맥락) */
  showAvailable?: boolean;
  // FormField가 cloneElement로 주입하는 접근성 props — 내부 input으로 전달한다.
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  required?: boolean;
}

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'item'; item: InventoryItem; index: number };

/**
 * 부품 검색 콤보박스 — 306개 부품을 부품명/P·N 타이핑으로 필터.
 * 빈 쿼리에서는 카테고리 헤더와 함께 전체를 스크롤 목록으로 보여준다
 * (기존 optgroup select와 동일한 탐색성 + 검색이라는 빠른 경로).
 */
export function PartCombobox({
  items,
  value,
  onSelect,
  showAvailable = false,
  ...fieldProps
}: PartComboboxProps) {
  const { t } = useTranslation('inventory');
  const listboxId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(
    () => items.find((i) => i.partId === value),
    [items, value],
  );

  const [query, setQuery] = useState(selected ? displayLabel(selected) : '');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // 외부에서 value가 바뀌면(프리필 등) 표시 텍스트를 동기화
  useEffect(() => {
    setQuery(selected ? displayLabel(selected) : '');
  }, [selected]);

  // 선택된 항목의 라벨이 그대로 남아있는 상태 = 검색 의도 없음 → 전체 목록
  const q =
    selected && query === displayLabel(selected)
      ? ''
      : query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return items;
    return items
      .filter(
        (i) =>
          i.partName.toLowerCase().includes(q) ||
          i.partNumber.toLowerCase().includes(q) ||
          i.partName_ko?.toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS);
  }, [items, q]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let index = 0;
    if (q) {
      for (const item of filtered) out.push({ kind: 'item', item, index: index++ });
      return out;
    }
    let lastCategory: string | null = null;
    for (const item of filtered) {
      if (item.category !== lastCategory) {
        lastCategory = item.category;
        out.push({ kind: 'header', key: item.category, label: t(`category.${item.category}`) });
      }
      out.push({ kind: 'item', item, index: index++ });
    }
    return out;
  }, [filtered, q, t]);

  const options = useMemo(
    () => rows.filter((r): r is Extract<Row, { kind: 'item' }> => r.kind === 'item').map((r) => r.item),
    [rows],
  );

  useEffect(() => {
    setHighlight(0);
  }, [q, open]);

  // 하이라이트 항목이 스크롤 밖으로 나가지 않게 유지
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  const commit = (item: InventoryItem) => {
    onSelect(item.partId);
    setQuery(displayLabel(item));
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        {...fieldProps}
        className={inputClass}
        value={query}
        placeholder={t('partPicker.placeholder')}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[highlight] ? optionId(highlight) : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          // 기존 선택이 있으면 전체 선택 — 타이핑 즉시 재검색으로 이어진다
          e.target.select();
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          // 선택 없이 떠나면 표시 텍스트를 확정값으로 되돌린다 (자유 텍스트 잔류 방지)
          setQuery(selected ? displayLabel(selected) : '');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) setOpen(true);
            else setHighlight((h) => Math.min(h + 1, options.length - 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
            return;
          }
          if (e.key === 'Enter' && open && options[highlight]) {
            // 목록이 열려있을 때의 Enter는 선택 — 폼 제출로 새지 않게 막는다
            e.preventDefault();
            commit(options[highlight]);
          }
        }}
      />
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              {t('partPicker.noResults')}
            </li>
          )}
          {rows.map((row) =>
            row.kind === 'header' ? (
              <li
                key={`h-${row.key}`}
                className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {row.label}
              </li>
            ) : (
              <li
                key={row.item.partId}
                id={optionId(row.index)}
                data-index={row.index}
                role="option"
                aria-selected={row.item.partId === value}
                // onMouseDown: input blur보다 먼저 실행되어 선택이 씹히지 않는다
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(row.item);
                }}
                onMouseEnter={() => setHighlight(row.index)}
                className={cn(
                  'flex cursor-pointer items-baseline justify-between gap-2 px-3 py-1.5 text-sm transition-colors',
                  row.index === highlight && 'bg-muted/60',
                )}
              >
                <span className="truncate">{row.item.partName}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {row.item.partNumber}
                  {showAvailable && (
                    <> · {t('actions.availableBadge', { n: row.item.availableQty })}</>
                  )}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
