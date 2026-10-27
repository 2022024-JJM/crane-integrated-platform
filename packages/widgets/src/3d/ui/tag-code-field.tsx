import { AlertTriangle, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@crane/core/lib/utils';
import { describeCodeChip, splitChipTail } from '../lib/tag-pick';
import { FIELD_INPUT } from './inspector-field-classes';
import { Field, type InspectorT } from './inspector-fields';
import { TagPickDialog } from './tag-pick-dialog';

/**
 * 인스펙터 카드의 "태그" 한 줄 — 코드 칸 하나(안쪽 끝에 ×). 칸을 누르면 태그
 * 연결 다이얼로그가 모델의 크레인으로 열리고, × 는 코드를 비운다. 맵핑
 * 카드와 상태 태그 카드가 같이 쓴다.
 *
 * 키는 저장하지 않는다 — 모델 craneId 와 코드로 런타임이 조립하고, 툴팁에
 * 그 키를 적는다(lib/tag-pick.ts `describeCodeChip`). 모델에 craneId 가 없으면
 * 칸이 amber 다 — 어느 소스에서도 값을 받지 못한다.
 */
export function TagCodeField({
  code,
  onChange,
  modelCraneId,
  t,
}: {
  code: string;
  onChange: (code: string) => void;
  modelCraneId?: string;
  t: InspectorT;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const chip = code ? describeCodeChip(code, modelCraneId) : null;
  const tail = chip ? splitChipTail(chip.text) : null;
  const fieldLabel = t('monitoring:inspector.tagPick.tag');

  return (
    <>
      <Field compact label={fieldLabel}>
        {/* × 를 칸 안에 두어 좁은 인스펙터에서 글자 폭을 번다. 코드는 가운데에서
            줄어 끝 번호(`_2`)가 남는다. 전체 키는 툴팁. */}
        <div
          className={cn(
            FIELD_INPUT,
            'flex min-w-0 flex-1 items-center gap-1 border pr-1',
            !code && 'text-muted-foreground',
            chip?.unresolved && 'border-amber-500 text-amber-500',
          )}
        >
          <button
            type="button"
            title={chip?.title}
            onClick={() => setDialogOpen(true)}
            className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1 text-left"
          >
            {chip && tail ? (
              <span className="flex min-w-0 flex-1">
                <span className="min-w-0 truncate">{tail.head}</span>
                <span className="shrink-0">{tail.end}</span>
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate">
                {t('monitoring:inspector.tagPick.pick')}
              </span>
            )}
            {chip?.unresolved ? (
              <AlertTriangle
                className="size-3 shrink-0"
                aria-label={t('monitoring:inspector.crane.missing')}
              />
            ) : null}
            {code ? null : (
              <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
            )}
          </button>
          {code ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm"
              aria-label={t('monitoring:inspector.tagPick.clear')}
              title={t('monitoring:inspector.tagPick.clear')}
              onClick={() => onChange('')}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
      </Field>
      <TagPickDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        value={code}
        modelCraneId={modelCraneId}
        onApply={(next) => {
          onChange(next);
          setDialogOpen(false);
        }}
      />
    </>
  );
}
