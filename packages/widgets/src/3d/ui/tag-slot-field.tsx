import {
  AlertTriangle,
  ChevronDown,
  FlaskConical,
  Radio,
  X,
  type LucideIcon,
} from 'lucide-react';
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
import {
  describeSlotChip,
  pickInitialSlot,
  splitChipTail,
} from '../lib/tag-pick';
import { FIELD_INPUT } from './inspector-field-classes';
import { Field, type InspectorT } from './inspector-fields';
import { TagPickDialog } from './tag-pick-dialog';

/** 슬롯 전환 버튼의 아이콘 — HUD 연결 칸·시뮬레이션 배지와 같은 그림. */
const SLOT_ICONS: Record<TagSlot, LucideIcon> = {
  realtime: Radio,
  virtual: FlaskConical,
};

/**
 * 인스펙터 카드의 "태그" 한 줄 — 슬롯 전환 버튼(실시간 · 시뮬레이션) + 고른
 * 슬롯의 키 칸(안쪽 끝에 ×). 칸을 누르면 태그 연결 다이얼로그가 그 슬롯
 * 탭으로 열리고, × 는 그 슬롯만 비운다. 맵핑 카드와 상태 태그 카드가 같이
 * 쓴다.
 *
 * 전환 버튼의 아이콘 색이 슬롯별 연결 여부(주황 — 다이얼로그 푸터의 연결된
 * 키와 같은 색, 못 찾는 키는 amber)이고, 툴팁에 그 슬롯의 키를 적어
 * 전환하지 않고도 다른 슬롯을 볼 수 있다. 처음 보일 슬롯은 연결된
 * 쪽(`pickInitialSlot`)이고, 다이얼로그에서 연결하면 그때 보던 탭으로
 * 옮긴다. 고른 슬롯은 화면 상태라 저장되지 않는다.
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
  const [slot, setSlot] = useState<TagSlot>(() => pickInitialSlot(value));
  const [dialogOpen, setDialogOpen] = useState(false);
  const catalog = useTagCatalog();

  const chipOf = (target: TagSlot) => {
    const slotKey = getSlotTagKey(value, target);
    return slotKey ? describeSlotChip(slotKey, target, catalog) : null;
  };
  const key = getSlotTagKey(value, slot);
  const chip = chipOf(slot);
  const tail = chip ? splitChipTail(chip.tail) : null;
  const fieldLabel = t('monitoring:inspector.tagPick.tag');

  return (
    <>
      <Field compact label={fieldLabel}>
        <div
          className="flex shrink-0 gap-0.5"
          role="group"
          aria-label={fieldLabel}
        >
          {TAG_SLOTS.map((option) => {
            const Icon = SLOT_ICONS[option];
            const optionChip = chipOf(option);
            const optionLabel = t(
              `monitoring:inspector.tagPick.slots.${option}`,
            );
            const optionTitle = optionChip
              ? `${optionLabel} : ${optionChip.text}`
              : optionLabel;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={slot === option}
                aria-label={optionTitle}
                title={optionTitle}
                className={cn(
                  'flex size-6 cursor-pointer items-center justify-center rounded-sm border',
                  slot === option
                    ? 'border-primary/50 bg-primary/15 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
                onClick={() => setSlot(option)}
              >
                <Icon
                  className={cn(
                    'size-3',
                    optionChip &&
                      (optionChip.unknown
                        ? 'text-amber-500'
                        : 'text-orange-400'),
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
        {/* 키 칸 — × 를 칸 안에 두어 좁은 인스펙터에서 글자 폭을 번다.
            앞부분(장비)이 먼저 줄고, 그다음 코드가 가운데에서 줄어 끝
            번호(`_2`)가 남는다. 전체 키는 툴팁. */}
        <div
          className={cn(
            FIELD_INPUT,
            'flex min-w-0 flex-1 items-center gap-1 border pr-1',
            !key && 'text-muted-foreground',
            chip?.unknown && 'border-amber-500 text-amber-500',
          )}
        >
          <button
            type="button"
            title={
              chip
                ? [chip.text, chip.title].filter(Boolean).join('\n')
                : undefined
            }
            onClick={() => setDialogOpen(true)}
            className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1 text-left"
          >
            {chip && tail ? (
              <span className="flex min-w-0 flex-1">
                <span className="min-w-0 shrink-[999] overflow-hidden text-ellipsis whitespace-pre">
                  {chip.lead}
                </span>
                <span className="min-w-0 truncate">{tail.head}</span>
                <span className="shrink-0">{tail.end}</span>
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate">
                {t('monitoring:inspector.tagPick.pick')}
              </span>
            )}
            {chip?.unknown ? (
              <AlertTriangle
                className="size-3 shrink-0"
                aria-label={t('monitoring:inspector.mapping.tagUnknown')}
              />
            ) : null}
            {key ? null : (
              <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
            )}
          </button>
          {key ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm"
              aria-label={t('monitoring:inspector.tagPick.clear')}
              title={t('monitoring:inspector.tagPick.clear')}
              onClick={() => onChange(setSlotTagKey(value, slot, ''))}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
      </Field>
      <TagPickDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialSlot={slot}
        value={value}
        modelCraneId={modelCraneId}
        onApply={(next, appliedSlot) => {
          onChange(next);
          setSlot(appliedSlot);
          setDialogOpen(false);
        }}
      />
    </>
  );
}
