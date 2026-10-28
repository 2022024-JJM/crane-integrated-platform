import { useTranslation } from 'react-i18next';
import type {
  ChecklistItem,
  ChecklistJudgment,
} from '@crane/domain/inspection';
import { KC } from '../../../shared/ui/kc';
import {
  failedItems,
  groupByCategory,
  setAllJudgments,
  type FieldJudgments,
} from '../lib/field-checklist';
import { FieldChip } from './field-shell';

const JUDGMENTS: ChecklistJudgment[] = ['pass', 'fail', 'na'];

/**
 * 점검 체크리스트 — 항목마다 양호/불량/해당없음 세 토글. 판정은 전부 양호에서
 * 시작하므로(lib/field-checklist `defaultJudgments`) 불량인 항목만 누르면 된다.
 * 지난 점검에서 불량이던 항목(`recheck`)은 맨 위 "다시 확인" 묶음으로 올린다.
 * 라벨은 ko 면 `_ko` 우선.
 */
export function FieldChecklistStep({
  template,
  judgments,
  onChange,
  recheck = [],
}: {
  template: ChecklistItem[];
  judgments: FieldJudgments;
  onChange: (next: FieldJudgments) => void;
  recheck?: readonly string[];
}) {
  const { t, i18n } = useTranslation();
  const ko = i18n.language.startsWith('ko');
  const label = (item: ChecklistItem) =>
    (ko && item.itemName_ko) || item.itemName;
  const fails = failedItems(template, judgments).length;
  const recheckSet = new Set(recheck);
  const recheckItems = template.filter((i) => recheckSet.has(i.id));
  const rest = template.filter((i) => !recheckSet.has(i.id));
  const renderItem = (item: ChecklistItem) => {
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
              j === 'pass' ? KC.ok : j === 'fail' ? KC.safety : KC.inverseBg;
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
                onClick={() => onChange({ ...judgments, [item.id]: j })}
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
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-[14px]" style={{ color: KC.muted }}>
          {fails > 0
            ? t('mro2:field.checklist.failedN', { n: fails })
            : t('mro2:field.checklist.hint')}
        </span>
        {fails > 0 ? (
          <FieldChip
            label={t('mro2:field.checklist.allPass')}
            active={false}
            onClick={() => onChange(setAllJudgments(template, 'pass'))}
          />
        ) : null}
      </div>
      {recheckItems.length > 0 ? (
        <section>
          <h3
            className="mb-2 text-[13px] font-semibold tracking-wide uppercase"
            style={{ color: KC.safety }}
          >
            {t('mro2:field.checklist.recheck', { n: recheckItems.length })}
          </h3>
          <ul className="flex flex-col gap-2">
            {recheckItems.map(renderItem)}
          </ul>
        </section>
      ) : null}
      {groupByCategory(rest).map((g) => (
        <section key={g.category}>
          <h3
            className="mb-2 text-[13px] font-semibold tracking-wide uppercase"
            style={{ color: KC.muted }}
          >
            {(ko && g.category_ko) || g.category}
          </h3>
          <ul className="flex flex-col gap-2">{g.items.map(renderItem)}</ul>
        </section>
      ))}
    </div>
  );
}
