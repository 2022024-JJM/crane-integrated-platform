import { describe, expect, it } from 'vitest';
import type { ChecklistItem } from '@crane/domain/inspection';
import {
  buildFieldChecklist,
  checklistOutcome,
  failedItems,
  groupByCategory,
  isChecklistComplete,
  setAllJudgments,
} from '../field-checklist';

const item = (id: string, category = 'A'): ChecklistItem =>
  ({
    id,
    category,
    itemName: id,
    judgment: null,
    actionRequired: 'none',
  }) as ChecklistItem;
const T = [item('a', 'X'), item('b', 'X'), item('c', 'Y')];

describe('checklist outcome', () => {
  it('미완이면 null, 전부 양호/해당없음이면 pass, 불량 하나면 fail, 빈 템플릿은 미완', () => {
    expect(checklistOutcome(T, { a: 'pass' })).toBeNull();
    expect(checklistOutcome(T, { a: 'pass', b: 'na', c: 'pass' })).toBe('pass');
    expect(checklistOutcome(T, { a: 'pass', b: 'fail', c: 'pass' })).toBe(
      'fail',
    );
    expect(isChecklistComplete([], {})).toBe(false);
  });
  it('setAllJudgments·failedItems', () => {
    expect(setAllJudgments(T, 'pass')).toEqual({
      a: 'pass',
      b: 'pass',
      c: 'pass',
    });
    expect(
      failedItems(T, { a: 'fail', b: 'pass', c: 'fail' }).map((i) => i.id),
    ).toEqual(['a', 'c']);
  });
  it('buildFieldChecklist 는 불량에 minor·repair_needed, 나머지 normal·none, 미판정은 null', () => {
    const out = buildFieldChecklist(T, { a: 'fail', b: 'pass' });
    expect(out[0]).toMatchObject({
      judgment: 'fail',
      severity: 'minor',
      actionRequired: 'repair_needed',
    });
    expect(out[1]).toMatchObject({
      judgment: 'pass',
      severity: 'normal',
      actionRequired: 'none',
    });
    expect(out[2]!.judgment).toBeNull();
    expect(T[0]!.judgment).toBeNull(); // 입력 불변
  });
  it('groupByCategory 는 순서를 지키며 묶는다', () => {
    expect(groupByCategory(T).map((g) => [g.category, g.items.length])).toEqual(
      [
        ['X', 2],
        ['Y', 1],
      ],
    );
  });
});
