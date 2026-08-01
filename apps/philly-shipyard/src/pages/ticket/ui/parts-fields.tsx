import { useTranslation } from 'react-i18next';
import { FileText, Plus, Trash2, Boxes } from 'lucide-react';
import { Button } from '@crane/ui/atoms/button';
import type { InventoryItem, PartsRequestItem } from '@crane/domain/inventory';
import { FOCUS_RING } from '../../../shared/ui/controls';
import { PartCombobox } from '../../../shared/ui/part-combobox';
import { cn } from '@crane/core/lib/utils';
import {
  FormSection,
  FormField,
  inputClass,
  textareaClass,
  type AccentColor,
} from './form-helpers';
import { AssigneeField } from './assignee-field';

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
  /** items와 1:1 대응하는 안정적 행 key */
  itemKeys: string[];
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
  itemKeys,
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

  return (
    <>
      <FormSection title={t('sections.basicInfo')} icon={FileText} accent={accent} step={1}>
        {craneSelectSlot}
        {prioritySlot}

        <FormField label={t('fields.requester')} required error={errors.requester}>
          {/* 인력 마스터에서 고르는 것이 기본, 직접 입력 폴백 — 담당자 필드와 동일 UX */}
          <AssigneeField
            performerType="internal"
            value={state.requester}
            onValueChange={onRequesterChange}
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
              <p className="text-xs text-muted-foreground">{t('fields.noPartsAdded')}</p>
            </div>
          )}
          {state.items.map((item, idx) => (
            <div
              key={itemKeys[idx] ?? idx}
              className="group flex items-center gap-2 rounded-lg border border-border bg-background p-2 transition-colors hover:border-primary/40"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                {idx + 1}
              </span>
              {/* 폭은 래퍼 div로 강제 — inputClass의 w-full과 폭 유틸이 충돌하지 않게 */}
              <div className="min-w-0 flex-1">
                <PartCombobox
                  items={inventoryItems}
                  value={item.partId}
                  onSelect={(partId) => onUpdateItem(idx, partId)}
                />
              </div>
              <div className="w-20 shrink-0">
                <input
                  type="number"
                  min={1}
                  className={inputClass + ' text-center'}
                  value={item.qty}
                  onChange={(e) => onUpdateQty(idx, Number(e.target.value))}
                />
              </div>
              <button
                type="button"
                onClick={() => onRemoveItem(idx)}
                className={cn('shrink-0 cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive', FOCUS_RING)}
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
