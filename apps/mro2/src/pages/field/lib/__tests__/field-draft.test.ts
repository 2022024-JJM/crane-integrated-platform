import { describe, expect, it } from 'vitest';
import {
  FIELD_MAX_PHOTOS,
  FIELD_STEPS,
  FIELD_SYMPTOM_MAX,
  addPhotos,
  canProceed,
  emptyDraft,
  hasSymptomPreset,
  setPartLine,
  toggleSymptomPreset,
} from '../field-draft';

describe('canProceed', () => {
  it('자산 없으면 asset 단계 막힘, 있으면 통과', () => {
    expect(canProceed('asset', emptyDraft())).toBe(false);
    expect(canProceed('asset', emptyDraft(''))).toBe(false);
    expect(canProceed('asset', emptyDraft('c1'))).toBe(true);
  });
  it('증상은 공백만이면 막힘', () => {
    expect(canProceed('symptom', { ...emptyDraft('c'), symptom: '  ' })).toBe(
      false,
    );
    expect(canProceed('symptom', { ...emptyDraft('c'), symptom: 'x' })).toBe(
      true,
    );
  });
  it('부품은 수량 양수인 줄이 하나는 있어야', () => {
    expect(
      canProceed('parts', {
        ...emptyDraft('c'),
        parts: [{ partId: 'p', qty: 0 }],
      }),
    ).toBe(false);
    expect(
      canProceed('parts', {
        ...emptyDraft('c'),
        parts: [{ partId: 'p', qty: 1 }],
      }),
    ).toBe(true);
  });
  it('점검 결과: 체크리스트 전 항목 판정이 조건', () => {
    const T = [
      {
        id: 'a',
        category: 'X',
        itemName: 'a',
        judgment: null,
        actionRequired: 'none',
      },
      {
        id: 'b',
        category: 'X',
        itemName: 'b',
        judgment: null,
        actionRequired: 'none',
      },
    ] as unknown as import('@crane/domain/inspection').ChecklistItem[];
    expect(canProceed('inspection', emptyDraft('c'), T)).toBe(false);
    expect(
      canProceed(
        'inspection',
        { ...emptyDraft('c'), checklist: { a: 'pass' } },
        T,
      ),
    ).toBe(false);
    expect(
      canProceed(
        'inspection',
        { ...emptyDraft('c'), checklist: { a: 'pass', b: 'fail' } },
        T,
      ),
    ).toBe(true);
    expect(canProceed('inspection', emptyDraft('c'), [])).toBe(false);
  });
  it('사진·우선순위는 항상 통과, 단계표는 종류마다 asset 으로 시작한다', () => {
    expect(canProceed('photo', emptyDraft())).toBe(true);
    expect(canProceed('priority', emptyDraft())).toBe(true);
    for (const steps of Object.values(FIELD_STEPS)) {
      expect(steps[0]).toBe('asset');
    }
  });
});

describe('symptom presets', () => {
  it('토글은 붙였다 떼고, 상한으로 자른다', () => {
    const a = toggleSymptomPreset('', '소음');
    expect(a).toBe('소음');
    expect(hasSymptomPreset(a, '소음')).toBe(true);
    const b = toggleSymptomPreset(a, '누유');
    expect(b).toBe('소음, 누유');
    expect(toggleSymptomPreset(b, '소음')).toBe('누유');
    expect(
      toggleSymptomPreset('x'.repeat(FIELD_SYMPTOM_MAX), 'y'),
    ).toHaveLength(FIELD_SYMPTOM_MAX);
  });
});

describe('setPartLine / addPhotos', () => {
  it('같은 부품은 수량만 바꾸고 0 이하는 제거, 수량은 정수', () => {
    const l1 = setPartLine([], 'p1', 2.7);
    expect(l1).toEqual([{ partId: 'p1', qty: 2 }]);
    expect(setPartLine(l1, 'p1', 5)).toEqual([{ partId: 'p1', qty: 5 }]);
    expect(setPartLine(l1, 'p1', 0)).toEqual([]);
  });
  it('사진은 상한까지만', () => {
    const f = (n: string) => new File([''], n);
    const many = Array.from({ length: FIELD_MAX_PHOTOS + 2 }, (_, i) =>
      f(`${i}`),
    );
    expect(addPhotos([], many)).toHaveLength(FIELD_MAX_PHOTOS);
    expect(addPhotos([f('a')], [f('b')])).toHaveLength(2);
  });
});
