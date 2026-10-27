import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useBulkWorkUpdate, type WorkTarget } from '@crane/features/triage';
import { getTechnicians } from '@crane/domain/shared';
import { KC } from '../../../shared/ui/kc';
import { KcButton } from '../../../shared/ui/kc-ui';

const field = 'h-8 min-w-0 flex-1 rounded-[4px] border px-2 text-[13px]';

/**
 * 담당자·예정일 변경 두 줄 — 목록 패널과 상세 머리가 같은 부품을 쓴다.
 * 적용 즉시 반영되고 토스트로 되돌릴 수 있다.
 */
export function SrAssignFields({
  target,
  assignee,
  due,
}: {
  target: WorkTarget;
  assignee: string;
  /** YYYY-MM-DD */
  due: string;
}) {
  const { t } = useTranslation('mro2');
  const bulk = useBulkWorkUpdate();
  const technicians = getTechnicians();
  const [nextAssignee, setNextAssignee] = useState(assignee);
  const [nextDue, setNextDue] = useState(due);
  const fieldStyle = {
    borderColor: KC.border,
    color: KC.ink,
    background: KC.bg,
  } as const;
  const run = (out: { changed: number; undo: () => void }, key: string) =>
    toast.success(t(key, { n: out.changed }), {
      action: out.changed
        ? { label: t('common:undo'), onClick: out.undo }
        : undefined,
    });

  return (
    <div className="flex flex-col gap-2">
      <label
        className="flex items-center gap-2 text-[13px]"
        style={{ color: KC.ink }}
      >
        <span className="w-[82px] shrink-0 font-bold">
          {t('sr.col.assignee')}:
        </span>
        <select
          value={nextAssignee}
          onChange={(e) => setNextAssignee(e.target.value)}
          className={field}
          style={fieldStyle}
        >
          {!technicians.some((x) => x.name === nextAssignee) ? (
            <option value={nextAssignee}>{nextAssignee || '-'}</option>
          ) : null}
          {technicians.map((x) => (
            <option key={x.id} value={x.name}>
              {x.name}
            </option>
          ))}
        </select>
        <KcButton
          variant="outline"
          className="shrink-0 !py-1 !text-[12px] whitespace-nowrap"
          disabled={nextAssignee === assignee}
          onClick={() =>
            run(bulk.reassign([target], nextAssignee), 'sr.bulk.reassigned')
          }
        >
          {t('sr.bulk.apply')}
        </KcButton>
      </label>
      <label
        className="flex items-center gap-2 text-[13px]"
        style={{ color: KC.ink }}
      >
        <span className="w-[82px] shrink-0 font-bold">
          {t('sr.bulk.date')}:
        </span>
        <input
          type="date"
          value={nextDue}
          onChange={(e) => setNextDue(e.target.value)}
          className={field}
          style={fieldStyle}
        />
        <KcButton
          variant="outline"
          className="shrink-0 !py-1 !text-[12px] whitespace-nowrap"
          disabled={nextDue === due}
          onClick={() =>
            run(bulk.reschedule([target], nextDue), 'sr.bulk.rescheduled')
          }
        >
          {t('sr.bulk.apply')}
        </KcButton>
      </label>
    </div>
  );
}
