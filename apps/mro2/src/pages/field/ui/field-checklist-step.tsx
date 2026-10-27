import { useTranslation } from 'react-i18next';
import type {
  ChecklistItem,
  ChecklistJudgment,
} from '@crane/domain/inspection';
import { KC } from '../../../shared/ui/kc';
import {
  groupByCategory,
  setAllJudgments,
  type FieldJudgments,
} from '../lib/field-checklist';
import { FieldChip } from './field-shell';

const JUDGMENTS: ChecklistJudgment[] = ['pass', 'fail', 'na'];

/**
 * 점검 체크리스트 — 항목마다 양호/불량/해당없음 세 토글. "전부 양호" 한 번으로
 * 정상 점검을 끝낼 수 있고, 불량만 바꾸면 된다. 라벨은 ko 면 `_ko` 우선.
 */
export function FieldChecklistStep({
  template,
  judgments,
  onChange,
}: {
  template: ChecklistItem[];
  judgments: FieldJudgments;
  onChange: (next: FieldJudgments) => void;
}) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith('ko');
  const label = (item: ChecklistItem) =>
    (ko && item.itemName_ko) || item.itemName;
  const judged = template.filter((i) => judgments[i.id] !== undefined).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[14px]" style={{ color: KC.muted }}>
          {t('mro2:field.checklist.progress', {
            n: judged,
            total: template.length,
          })}
        </span>
        <FieldChip
          label={t('mro2:field.checklist.allPass')}
          active={false}
          onClick={() => onChange(setAllJudgments(template, 'pass'))}
        />
      </div>
      {groupByCategory(template).map((g) => (
        <section key={g.category}>
          <h3
            className="mb-2 text-[13px] font-semibold tracking-wide uppercase"
            style={{ color: KC.muted }}
          >
            {(ko && g.category_ko) || g.category}
          </h3>
          <ul className="flex flex-col gap-2">
            {g.items.map((item) => {
              const cur = judgments[item.id];
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded p-2 pl-3"
                  style={{
                    background:
                      cur === 'fail'
                        ? 'var(--kc-safety-bg, var(--kc-bg-row))'
                        : KC.bgSubtle,
                    border: `1px solid ${cur === 'fail' ? KC.safety : KC.border}`,
                    borderRadius: KC.radius,
                  }}
                >
                  <span
                    className="min-w-0 flex-1 text-[15px] font-semibold"
                    style={{ color: KC.ink }}
                  >
                    {label(item)}
                  </span>
                  <div
                    className="flex shrink-0 gap-1"
                    role="radiogroup"
                    aria-label={label(item)}
                  >
                    {JUDGMENTS.map((j) => {
                      const active = cur === j;
                      const bg =
                        j === 'pass'
                          ? KC.ok
                          : j === 'fail'
                            ? KC.safety
                            : KC.inverseBg;
                      const fg =
                        j === 'pass'
                          ? KC.onOk
                          : j === 'fail'
                            ? KC.onSafety
                            : KC.inverseText;
                      return (
                        <button
                          key={j}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() =>
                            onChange({ ...judgments, [item.id]: j })
                          }
                          className="h-11 min-w-11 rounded px-2 text-[14px] font-bold"
                          style={{
                            background: active ? bg : 'transparent',
                            color: active ? fg : KC.muted,
                            border: `1px solid ${active ? 'transparent' : KC.border}`,
                            borderRadius: KC.radius,
                          }}
                        >
                          {t(`mro2:field.checklist.${j}`)}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
