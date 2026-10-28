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

describe('defaultJudgments / previousFailures', () => {
  it('기본 판정은 전부 양호', async () => {
    const { defaultJudgments } = await import('../field-checklist');
    expect(defaultJudgments(T)).toEqual({ a: 'pass', b: 'pass', c: 'pass' });
    expect(defaultJudgments([])).toEqual({});
  });

  it('같은 장비의 최근 완료 점검에서 불량이던 항목을 id 또는 이름으로 맞춘다', async () => {
    const { previousFailures } = await import('../field-checklist');
    const wo = (o: Record<string, unknown>) =>
      ({
        id: 'w',
        craneId: 'c1',
        status: 'completed',
        scheduledDate: '2026-01-01',
        actualDate: null,
        checklistItems: [],
        ...o,
      }) as never;
    const older = wo({
      id: 'old',
      actualDate: '2026-01-05',
      checklistItems: [{ ...item('a'), judgment: 'fail' }],
    });
    const newer = wo({
      id: 'new',
      actualDate: '2026-02-01',
      checklistItems: [
        { ...item('zzz'), itemName: 'b', judgment: 'fail' },
        { ...item('c'), judgment: 'pass' },
      ],
    });
    const other = wo({
      id: 'x',
      craneId: 'c2',
      actualDate: '2026-03-01',
      checklistItems: [{ ...item('c'), judgment: 'fail' }],
    });
    // 최근 것(newer)만 본다 — older 의 a 는 안 올라온다. 이름으로 b 를 맞춘다.
    expect(previousFailures([older, newer, other], 'c1', T)).toEqual(['b']);
    // 지금 수행 중인 점검은 제외
    expect(previousFailures([older, newer], 'c1', T, 'new')).toEqual(['a']);
    // 완료 아닌 점검·빈 체크리스트·다른 장비는 무시
    const open = wo({
      id: 'o',
      status: 'scheduled',
      actualDate: '2026-05-01',
      checklistItems: [{ ...item('c'), judgment: 'fail' }],
    });
    expect(previousFailures([open], 'c1', T)).toEqual([]);
    expect(previousFailures([], 'c1', T)).toEqual([]);
  });
});
