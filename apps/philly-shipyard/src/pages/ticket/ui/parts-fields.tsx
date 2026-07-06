import { useTranslation } from 'react-i18next';
import { FileText, Plus, Trash2, Boxes } from 'lucide-react';
import { Button } from '@crane/ui/atoms/button';
import type { InventoryItem, PartsRequestItem } from '@crane/domain/inventory';
import {
  FormSection,
  FormField,
  inputClass,
  selectClass,
  textareaClass,
  type AccentColor,
} from './form-helpers';

export interface PartsFieldsState {
  requester: string;
  note: string;
  items: PartsRequestItem[];
}

export type PartsFieldsErrors = Partial<Record<'requester' | 'items', string>>;

interface PartsFieldsProps {
  accent: AccentColor;
  state: PartsFieldsState;
  errors: PartsFieldsErrors;
  onRequesterChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  onUpdateItem: (idx: number, partId: string) => void;
  onUpdateQty: (idx: number, qty: number) => void;
  inventoryItems: InventoryItem[];
  craneSelectSlot: React.ReactNode;
  prioritySlot: React.ReactNode;
}

export function PartsFields({
  accent,
  state,
  errors,
  onRequesterChange,
  onNoteChange,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onUpdateQty,
  inventoryItems,
  craneSelectSlot,
  prioritySlot,
}: PartsFieldsProps) {
  const { t } = useTranslation('ticket');
  const { t: tInventory } = useTranslation('inventory');

  // BOM 클러스터(카테고리)별로 부품 옵션 그룹핑 — 306개 옵션 탐색성 개선
  const groupedItems: [InventoryItem['category'], InventoryItem[]][] = [];
  for (const inv of inventoryItems) {
    const group = groupedItems.find(([category]) => category === inv.category);
    if (group) group[1].push(inv);
    else groupedItems.push([inv.category, [inv]]);
  }

  return (
    <>
      <FormSection title={t('sections.basicInfo')} icon={FileText} accent={accent} step={1}>
        {craneSelectSlot}
        {prioritySlot}

        <FormField label={t('fields.requester')} required error={errors.requester}>
          <input
            className={inputClass}
            placeholder={t('placeholders.assignedTo')}
            value={state.requester}
            onChange={(e) => onRequesterChange(e.target.value)}
          />
        </FormField>

        <FormField label={t('fields.note')} colSpan={2}>
          <textarea
            className={textareaClass}
            rows={2}
            placeholder={t('placeholders.note')}
            value={state.note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection title={t('sections.parts')} icon={Boxes} accent={accent} step={2}>
        <div className="sm:col-span-2 space-y-2">
          {state.items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-center">
              <Boxes className="size-6 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">{t('fields.partName')}</p>
            </div>
          )}
          {state.items.map((item, idx) => (
            <div
              key={idx}
              className="group flex items-center gap-2 rounded-lg border border-border bg-background p-2 transition-colors hover:border-primary/40"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                {idx + 1}
              </span>
              <select
                className={selectClass + ' flex-1'}
                value={item.partId}
                onChange={(e) => onUpdateItem(idx, e.target.value)}
              >
                <option value="">{t('fields.partName')}</option>
                {groupedItems.map(([category, invItems]) => (
                  <optgroup key={category} label={tInventory(`category.${category}`)}>
                    {invItems.map((inv) => (
                      <option key={inv.partId} value={inv.partId}>
                        {inv.partName} ({inv.partNumber})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <input
                type="number"
                min={1}
                className={inputClass + ' w-20 text-center'}
                value={item.qty}
                onChange={(e) => onUpdateQty(idx, Number(e.target.value))}
              />
              <button
                type="button"
                onClick={() => onRemoveItem(idx)}
                className="shrink-0 cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {errors.items && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <span className="inline-block size-1 rounded-full bg-destructive" />
              {errors.items}
            </p>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onAddItem} className="w-full border-dashed">
            <Plus className="size-4" />
            {t('fields.addPart')}
          </Button>
        </div>
      </FormSection>
    </>
  );
}
