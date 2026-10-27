import { describe, expect, it } from 'vitest';
import type { OpenRisk } from '@crane/features/risk';
import { TODO_LIMIT, buildTodoRows, toMro2Path } from '../todo-rows';

const NOW = new Date('2026-07-10T00:00:00Z').getTime();
const r = (o: Partial<OpenRisk>): OpenRisk =>
  ({
    id: 'x',
    riskType: 'production',
    source: 'repair',
    title: 'T',
    severity: 'minor',
    date: '2026-07-01',
    detailPath: '/p',
    ...o,
  }) as OpenRisk;

describe('buildTodoRows', () => {
  it('안전 먼저, 심각도, 오래된 순. ko 제목 우선. daysOpen 은 0 이상', () => {
    const rows = buildTodoRows(
      [
        r({ id: 'p-old', date: '2026-06-01' }),
        r({ id: 's-minor', riskType: 'safety', title_ko: '한글' }),
        r({
          id: 's-crit',
          riskType: 'safety',
          severity: 'critical',
          date: '2026-07-09',
        }),
        r({ id: 'future', date: '2026-08-01' }),
      ],
      NOW,
      true,
    );
    expect(rows.map((x) => x.id)).toEqual([
      's-crit',
      's-minor',
      'p-old',
      'future',
    ]);
    expect(rows[1]!.title).toBe('한글');
    expect(rows[0]!.daysOpen).toBe(1);
    expect(rows[3]!.daysOpen).toBe(0);
    expect(buildTodoRows([r({ title_ko: '한글' })], NOW, false)[0]!.title).toBe(
      'T',
    );
  });
  it('상한·빈 배열·잘못된 날짜', () => {
    const many = Array.from({ length: TODO_LIMIT + 2 }, (_, i) =>
      r({ id: String(i) }),
    );
    expect(buildTodoRows(many, NOW, true)).toHaveLength(TODO_LIMIT);
    expect(buildTodoRows(many, NOW, true, 0)).toEqual([]);
    expect(buildTodoRows([], NOW, true)).toEqual([]);
    expect(
      buildTodoRows([r({ date: 'bad' })], NOW, true)[0]!.daysOpen,
    ).toBeGreaterThan(0);
  });
});

describe('toMro2Path', () => {
  it('MRO 주소를 MRO2 로, 모르는 건 목록으로', () => {
    expect(toMro2Path('/inspection/insp-001')).toBe(
      '/mro2/service-requests/inspection/insp-001',
    );
    expect(toMro2Path('/maintenance?wo=repair-001')).toBe(
      '/mro2/service-requests/repair/repair-001',
    );
    expect(toMro2Path('/inventory?part=a%2Fb')).toBe(
      '/mro2/inventory?part=a%2Fb',
    );
    expect(toMro2Path('/mro2/assets/x')).toBe('/mro2/assets/x');
    expect(toMro2Path('/history')).toBe('/mro2/service-requests');
    expect(
      buildTodoRows(
        [
          {
            id: 'r',
            riskType: 'safety',
            source: 'repair',
            title: 'T',
            severity: 'minor',
            date: '2026-07-01',
            detailPath: '/maintenance?wo=r1',
          } as OpenRisk,
        ],
        NOW,
        true,
      )[0]!.detailPath,
    ).toBe('/mro2/service-requests/repair/r1');
  });
});

describe('overdue inspection title', () => {
  it('점검 id 로 종류 라벨을 찾으면 제목으로, 없으면 원래 제목', () => {
    const risk = r({
      id: 'overdue-insp-1',
      source: 'overdue_inspection',
      title: 'INS-1',
    });
    expect(
      buildTodoRows([risk], NOW, true, 5, { 'insp-1': '정기 점검' })[0]!.title,
    ).toBe('정기 점검');
    expect(buildTodoRows([risk], NOW, true)[0]!.title).toBe('INS-1');
  });
});
