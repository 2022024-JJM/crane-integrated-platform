import { describe, expect, it } from 'vitest';
import type { ChecklistItem, InspectionWO } from '@crane/domain/inspection';
import {
  buildRepairFromInspection,
  failedChecklistItems,
} from '../convert-inspection';

const item = (o: Partial<ChecklistItem>): ChecklistItem =>
  ({
    id: 'x',
    category: 'Safety',
    category_ko: '안전 장치',
    itemName: 'Brake',
    itemName_ko: '브레이크',
    judgment: null,
    actionRequired: 'none',
    ...o,
  }) as ChecklistItem;
const wo = (o: Partial<InspectionWO> = {}): InspectionWO =>
  ({
    id: 'i1',
    woNumber: 'INS-9',
    craneId: 'c1',
    craneName: 'C1',
    siteId: 's',
    siteName: 'S',
    assignedTo: '점검자',
    checklistItems: [
      item({ id: 'a', judgment: 'fail' }),
      item({
        id: 'b',
        judgment: 'pass',
        itemName: 'Rope',
        itemName_ko: '로프',
      }),
      item({
        id: 'c',
        judgment: 'fail',
        itemName: 'Limit',
        itemName_ko: '리밋',
        category: 'Elec',
        category_ko: '전기',
      }),
    ],
    ...o,
  }) as InspectionWO;
const sug = {
  assignedTo: '김내부',
  performerType: 'internal' as const,
  scheduledDate: '2026-10-29',
  reason: 'default' as const,
  dateReason: 'nextFree' as const,
};
const opts = { now: '2026-10-28T03:00:00.000Z', triagedBy: 'admin', ko: true };

describe('failedChecklistItems', () => {
  it('불량만, 순서 유지', () => {
    expect(failedChecklistItems(wo()).map((i) => i.id)).toEqual(['a', 'c']);
    expect(failedChecklistItems(wo({ checklistItems: [] }))).toEqual([]);
  });
});

describe('buildRepairFromInspection', () => {
  it('불량 항목·소견을 증상으로, 첫 불량의 카테고리를 부위로, 접수까지 끝난 현장 표식', () => {
    const d = buildRepairFromInspection(
      wo({ findings_ko: '마모 심함' }),
      sug,
      opts,
    );
    expect(d).toMatchObject({
      craneId: 'c1',
      componentName: '안전 장치',
      failureDescription: '브레이크, 리밋 · 마모 심함',
      sourceType: 'inspection',
      sourceWoNumber: 'INS-9',
      priority: 'high',
      assignedTo: '김내부',
      performerType: 'internal',
      scheduledStart: '2026-10-29',
      scheduledEnd: '2026-10-29',
    });
    expect(d.fieldReport).toEqual({
      reportedBy: '점검자',
      reportedAt: opts.now,
      triagedAt: opts.now,
      triagedBy: 'admin',
    });
  });
  it('현장 보고자가 있으면 그 이름, 영어 화면이면 영어 라벨', () => {
    const d = buildRepairFromInspection(
      wo({
        fieldReport: { reportedBy: '현장인', reportedAt: 'x' },
        findings: 'worn',
      }),
      sug,
      { ...opts, ko: false },
    );
    expect(d.fieldReport?.reportedBy).toBe('현장인');
    expect(d.componentName).toBe('Safety');
    expect(d.failureDescription).toBe('Brake, Limit · worn');
  });
  it('불량이 없고 소견도 없으면 WO 번호를 증상으로, 부위는 General', () => {
    const d = buildRepairFromInspection(
      wo({ checklistItems: [], findings: undefined }),
      sug,
      opts,
    );
    expect(d.componentName).toBe('General');
    expect(d.failureDescription).toBe('INS-9');
  });
});
