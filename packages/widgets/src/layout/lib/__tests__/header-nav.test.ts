import { describe, expect, it } from 'vitest';
import type { NavItem } from '@crane/core/types/navigation';
import { LayoutDashboard } from 'lucide-react';
import { activeSubItem, needsExactMatch, usesHeaderNav } from '../header-nav';

const item = (path: string, extra: Partial<NavItem> = {}): NavItem => ({
  label: path,
  path,
  icon: LayoutDashboard,
  ...extra,
});

describe('usesHeaderNav', () => {
  it('Indoorshop.OT 만 헤더 가로 메뉴', () => {
    expect(usesHeaderNav('indoorshop-ot')).toBe(true);
    for (const role of [undefined, '', 'indoorshop', 'keyin', 'admin']) {
      expect(usesHeaderNav(role)).toBe(false);
    }
  });
});

describe('needsExactMatch', () => {
  const dashboard = item('/indoorshop');
  const performance = item('/indoorshop/performance');
  const docs = item('/indoorshop/docs');
  const items = [dashboard, performance, docs];

  it('다른 항목의 접두인 항목은 정확히 일치할 때만', () => {
    expect(needsExactMatch(dashboard, items)).toBe(true);
  });

  it('접두가 아닌 항목은 하위 화면에서도 켜진다', () => {
    expect(needsExactMatch(performance, items)).toBe(false);
  });

  it('end · 루트는 늘 정확히', () => {
    expect(needsExactMatch(item('/a', { end: true }), [])).toBe(true);
    expect(needsExactMatch(item('/'), [])).toBe(true);
  });

  it('이름만 겹치는 경로(/indoorshop-x)는 접두로 보지 않는다', () => {
    expect(needsExactMatch(dashboard, [dashboard, item('/indoorshop-x')])).toBe(
      false,
    );
  });

  it('자기 자신만 있으면 접두 아님', () => {
    expect(needsExactMatch(dashboard, [dashboard])).toBe(false);
  });
});

describe('activeSubItem', () => {
  const base = '/indoorshop/zones/assembly';
  const status = { label: '현황', path: `${base}?view=status` };
  const perf = { label: '실적', path: `${base}?view=performance` };
  const children = [status, perf];

  it('쿼리에 갈래가 없으면 첫 갈래', () => {
    expect(activeSubItem(children, base, '')).toBe(status);
  });

  it('쿼리의 갈래를 고른다 — 다른 쿼리가 섞여도', () => {
    expect(activeSubItem(children, base, '?view=performance')).toBe(perf);
    expect(
      activeSubItem(
        children,
        `${base}/asm-pbs`,
        '?tab=viewer&view=performance',
      ),
    ).toBe(perf);
  });

  it('모르는 갈래 값은 첫 갈래', () => {
    expect(activeSubItem(children, base, '?view=unknown')).toBe(status);
  });

  it('항목 화면 밖이면 null', () => {
    expect(
      activeSubItem(children, '/indoorshop/zones/painting', ''),
    ).toBeNull();
    expect(
      activeSubItem(children, '/indoorshop/zones/assemblyX', ''),
    ).toBeNull();
  });

  it('갈래가 없으면 null', () => {
    expect(activeSubItem([], base, '?view=status')).toBeNull();
  });
});
