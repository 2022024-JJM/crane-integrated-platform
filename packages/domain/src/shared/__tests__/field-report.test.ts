import { describe, expect, it } from 'vitest';
import { isUntriagedFieldReport, markTriaged } from '../field-report';

describe('field report', () => {
  it('표식이 없거나 처리됐으면 접수 아님, 있고 미처리면 접수', () => {
    expect(isUntriagedFieldReport(undefined)).toBe(false);
    expect(isUntriagedFieldReport({ reportedBy: 'a', reportedAt: 't' })).toBe(
      true,
    );
    expect(
      isUntriagedFieldReport({
        reportedBy: 'a',
        reportedAt: 't',
        triagedAt: 'u',
      }),
    ).toBe(false);
  });
  it('markTriaged 는 한 번만 찍고 처리된 것은 참조 그대로', () => {
    const r = markTriaged({ reportedBy: 'a', reportedAt: 't' }, 'admin', 'u');
    expect(r).toEqual({
      reportedBy: 'a',
      reportedAt: 't',
      triagedAt: 'u',
      triagedBy: 'admin',
    });
    expect(markTriaged(r, 'other', 'v')).toBe(r);
  });
});
