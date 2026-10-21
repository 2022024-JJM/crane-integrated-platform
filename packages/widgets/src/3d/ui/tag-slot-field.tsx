import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import {
  TAG_SLOTS,
  getSlotTagKey,
  setSlotTagKey,
  type TagKeySlots,
  type TagSlot,
} from '@crane/domain/3d';
import { useTagCatalog } from '@crane/features/3d';
import { cn } from '@crane/core/lib/utils';
import { Button } from '@crane/ui/atoms/button';
import { describeSlotChip } from '../lib/tag-pick';
import { FIELD_INPUT } from './inspector-field-classes';
import { Field, type InspectorT } from './inspector-fields';
import { TagPickDialog } from './tag-pick-dialog';

/**
 * 인스펙터 카드의 태그 슬롯 두 줄(실시간 · 시뮬레이션) — 줄을 누르면 태그
 * 연결 다이얼로그가 그 슬롯 탭으로 열리고, × 는 그 슬롯만 비운다. 맵핑
 * 카드와 상태 태그 카드가 같이 쓴다.
 *
 * 칩은 lib/tag-pick.ts `describeSlotChip` — 목록에서 못 찾는 키는 amber 로
 * 보존한다(사용자가 다시 고르기 전까지 지우지 않는다).
 */
export function TagSlotField({
  value,
  onChange,
  modelCraneId,
  t,
}: {
  value: TagKeySlots;
  onChange: (next: TagKeySlots) => void;
  modelCraneId?: string;
  t: InspectorT;
}) {
  const [openSlot, setOpenSlot] = useState<TagSlot | null>(null);
  const catalog = useTagCatalog();

  return (
    <>
      {TAG_SLOTS.map((slot) => {
        const key = getSlotTagKey(value, slot);
        const chip = key ? describeSlotChip(key, slot, catalog) : null;
        return (
          <Field
            key={slot}
            compact
            label={t(`monitoring:inspector.tagPick.slots.${slot}`)}
          >
            <button
              type="button"
              title={chip?.title}
              onClick={() => setOpenSlot(slot)}
              className={cn(
                FIELD_INPUT,
                'flex min-w-0 flex-1 cursor-pointer items-center gap-1 border text-left',
                !key && 'text-muted-foreground',
                chip?.unknown && 'border-amber-500 text-amber-500',
              )}
            >
              <span className="min-w-0 flex-1 truncate font-mono">
                {chip?.text ?? t('monitoring:inspector.tagPick.pick')}
              </span>
              {chip?.unknown ? (
                <AlertTriangle
                  className="size-3 shrink-0"
                  aria-label={t('monitoring:inspector.mapping.tagUnknown')}
                />
              ) : null}
              <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
            </button>
            {key ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground shrink-0"
                aria-label={t('monitoring:inspector.tagPick.clear')}
                title={t('monitoring:inspector.tagPick.clear')}
                onClick={() => onChange(setSlotTagKey(value, slot, ''))}
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </Field>
        );
      })}
      <TagPickDialog
        open={openSlot !== null}
        onOpenChange={(open) => {
          if (!open) setOpenSlot(null);
        }}
        initialSlot={openSlot ?? 'realtime'}
        value={value}
        modelCraneId={modelCraneId}
        onApply={(next) => {
          onChange(next);
          setOpenSlot(null);
        }}
      />
    </>
  );
}
