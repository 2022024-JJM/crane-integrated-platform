import type {
  ChecklistItem,
  ChecklistJudgment,
  InspectionWO,
} from '@crane/domain/inspection';

/**
 * 현장 점검 체크리스트 — 사무실의 기본 체크리스트(getDefaultChecklist)를 그대로
 * 항목별 양호/불량/해당없음 토글로 보여 주고, 판정을 채워 InspectionWO 에
 * 싣는다. 사무실이 다시 입력할 것이 없는 것이 "점검관리 최소화" 다.
 */
export type FieldJudgments = Record<string, ChecklistJudgment>;

export function isChecklistComplete(
  template: readonly ChecklistItem[],
  judgments: FieldJudgments,
): boolean {
  return (
    template.length > 0 && template.every((i) => judgments[i.id] !== undefined)
  );
}

/** 불량이 하나라도 있으면 fail, 전부 판정됐고 불량이 없으면 pass, 미완이면 null. */
export function checklistOutcome(
  template: readonly ChecklistItem[],
  judgments: FieldJudgments,
): 'pass' | 'fail' | null {
  if (!isChecklistComplete(template, judgments)) return null;
  return template.some((i) => judgments[i.id] === 'fail') ? 'fail' : 'pass';
}

export function failedItems(
  template: readonly ChecklistItem[],
  judgments: FieldJudgments,
): ChecklistItem[] {
  return template.filter((i) => judgments[i.id] === 'fail');
}

export function setAllJudgments(
  template: readonly ChecklistItem[],
  judgment: ChecklistJudgment,
): FieldJudgments {
  const out: FieldJudgments = {};
  for (const i of template) out[i.id] = judgment;
  return out;
}

/**
 * 현장 점검의 시작 상태 — 전부 양호. 작업자는 불량인 항목만 누른다.
 * "0/12 판정" 에서 시작해 12번 누르던 것을 불량 수만큼으로 줄인다.
 */
export function defaultJudgments(
  template: readonly ChecklistItem[],
): FieldJudgments {
  return setAllJudgments(template, 'pass');
}

/**
 * 같은 장비의 가장 최근 완료 점검에서 불량이던 항목 — 지금 템플릿의 항목 id 로
 * 돌려준다(id 가 같으면 id, 아니면 항목 이름으로 맞춘다). 이번 점검에서
 * "다시 확인" 으로 위에 올린다. `excludeId` 는 지금 수행 중인 점검.
 */
export function previousFailures(
  inspections: readonly InspectionWO[],
  craneId: string,
  template: readonly ChecklistItem[],
  excludeId?: string,
): string[] {
  const dateOf = (w: InspectionWO) => w.actualDate ?? w.scheduledDate;
  const last = inspections
    .filter(
      (w) =>
        w.craneId === craneId &&
        w.status === 'completed' &&
        w.id !== excludeId &&
        w.checklistItems.length > 0,
    )
    .sort((a, b) =>
      dateOf(a) < dateOf(b) ? 1 : dateOf(a) > dateOf(b) ? -1 : 0,
    )[0];
  if (!last) return [];
  const failedIds = new Set<string>();
  const failedNames = new Set<string>();
  for (const item of last.checklistItems) {
    if (item.judgment !== 'fail') continue;
    failedIds.add(item.id);
    failedNames.add(item.itemName);
  }
  return template
    .filter((i) => failedIds.has(i.id) || failedNames.has(i.itemName))
    .map((i) => i.id);
}

/** 판정을 체크리스트 항목에 입힌다 — 불량은 minor·repair_needed(사무실 submit 규칙과 같다). */
export function buildFieldChecklist(
  template: readonly ChecklistItem[],
  judgments: FieldJudgments,
): ChecklistItem[] {
  return template.map((item) => {
    const judgment = judgments[item.id] ?? null;
    return {
      ...item,
      judgment,
      severity: judgment === 'fail' ? 'minor' : 'normal',
      actionRequired: judgment === 'fail' ? 'repair_needed' : 'none',
    };
  });
}

/** 카테고리별 묶음(템플릿 순서 유지). */
export function groupByCategory(
  template: readonly ChecklistItem[],
): Array<{ category: string; category_ko?: string; items: ChecklistItem[] }> {
  const groups: Array<{
    category: string;
    category_ko?: string;
    items: ChecklistItem[];
  }> = [];
  for (const item of template) {
    const g = groups.find((x) => x.category === item.category);
    if (g) g.items.push(item);
    else
      groups.push({
        category: item.category,
        category_ko: item.category_ko,
        items: [item],
      });
  }
  return groups;
}
