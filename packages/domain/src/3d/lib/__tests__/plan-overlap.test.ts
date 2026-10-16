import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import {
  collectPlanHiddenIds,
  isPlanOverlapListEqual,
  planOverlapKey,
  resolvePlanOverlaps,
  type PlanOverlapMember,
} from '../plan-overlap';

function box(
  min: [number, number, number],
  max: [number, number, number],
): Box3 {
  return new Box3(new Vector3(...min), new Vector3(...max));
}

function member(id: string, boxes: Box3[]): PlanOverlapMember {
  const bounds = new Box3();
  for (const b of boxes) bounds.union(b);
  return { id, bounds, boxes };
}

describe('resolvePlanOverlaps', () => {
  it('평면에서 겹치고 높이가 다른 쌍 — 위·아래와 수직 여유', () => {
    // 타워(0~30m 높이, 발자국 4×4) 위를 지브(높이 40~42, 길이 60)가 지난다.
    const tower = member('tower', [box([-2, 0, -2], [2, 30, 2])]);
    const jib = member('jib', [box([-30, 40, -1], [30, 42, 1])]);
    const out = resolvePlanOverlaps([tower, jib]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: 'jib|tower',
      upperId: 'jib',
      lowerId: 'tower',
      gap: 10,
    });
  });

  it('평면에서 안 겹치면 없다 — 높이가 같아도', () => {
    const a = member('a', [box([0, 0, 0], [1, 10, 1])]);
    const b = member('b', [box([5, 0, 5], [6, 10, 6])]);
    expect(resolvePlanOverlaps([a, b])).toEqual([]);
  });

  it('경계 — 발자국이 정확히 닿으면 겹침, 살짝 떨어지면 아님', () => {
    const a = member('a', [box([0, 0, 0], [1, 10, 1])]);
    const touch = member('t', [box([1, 20, 0], [2, 22, 1])]);
    const apart = member('p', [box([1.001, 20, 0], [2, 22, 1])]);
    expect(resolvePlanOverlaps([a, touch])).toHaveLength(1);
    expect(resolvePlanOverlaps([a, apart])).toHaveLength(0);
  });

  it('여러 메쉬 쌍이 겹치면 가장 작은 여유를 택하고 그 쌍 기준으로 위·아래를 정한다', () => {
    const low = member('low', [
      box([0, 0, 0], [10, 5, 10]), // 낮은 몸체
      box([4, 0, 4], [6, 35, 6]), // 높은 기둥 — 지브와 5 차이
    ]);
    const jib = member('jib', [box([-20, 40, 4], [20, 41, 6])]);
    const out = resolvePlanOverlaps([low, jib]);
    expect(out[0].gap).toBe(5);
    expect(out[0].upperId).toBe('jib');
  });

  it('높이까지 겹치면 여유가 0 이하다(실제 충돌 여부는 충돌 감지 몫)', () => {
    const a = member('a', [box([0, 0, 0], [10, 10, 10])]);
    const b = member('b', [box([5, 8, 5], [15, 20, 15])]);
    const out = resolvePlanOverlaps([a, b]);
    expect(out[0].gap).toBeLessThanOrEqual(0);
  });

  it('빈 박스 목록·같은 id 는 건너뛴다', () => {
    const empty = member('e', []);
    const a = member('a', [box([0, 0, 0], [1, 1, 1])]);
    const dup = member('a', [box([0, 5, 0], [1, 6, 1])]);
    expect(resolvePlanOverlaps([empty, a])).toEqual([]);
    expect(resolvePlanOverlaps([a, dup])).toEqual([]);
  });

  it('출력 배열을 비우고 재사용한다', () => {
    const a = member('a', [box([0, 0, 0], [1, 1, 1])]);
    const b = member('b', [box([0, 5, 0], [1, 6, 1])]);
    const out = resolvePlanOverlaps([a, b]);
    const again = resolvePlanOverlaps([a], out);
    expect(again).toBe(out);
    expect(again).toHaveLength(0);
  });
});

describe('planOverlapKey', () => {
  it('id 순서와 무관하게 같은 키', () => {
    expect(planOverlapKey('b', 'a')).toBe(planOverlapKey('a', 'b'));
  });
});

describe('isPlanOverlapListEqual', () => {
  const base = { key: 'a|b', upperId: 'a', lowerId: 'b', gap: 10 };

  it('여유 값이 달라도 같은 쌍·위아래면 같다(숨은선 대상이 같다)', () => {
    expect(isPlanOverlapListEqual([base], [{ ...base, gap: 0.5 }])).toBe(true);
    expect(isPlanOverlapListEqual([base], [{ ...base, gap: -3 }])).toBe(true);
    expect(isPlanOverlapListEqual([], [])).toBe(true);
  });

  it('길이·키·위아래·순서가 다르면 다르다', () => {
    const other = { key: 'c|d', upperId: 'c', lowerId: 'd', gap: 1 };
    expect(isPlanOverlapListEqual([base], [])).toBe(false);
    expect(isPlanOverlapListEqual([base], [{ ...base, key: 'a|c' }])).toBe(
      false,
    );
    expect(
      isPlanOverlapListEqual(
        [base],
        [{ ...base, upperId: 'b', lowerId: 'a' }],
      ),
    ).toBe(false);
    expect(isPlanOverlapListEqual([base, other], [other, base])).toBe(false);
  });
});

describe('collectPlanHiddenIds', () => {
  it('아래쪽 id 만 순서대로, 중복 없이', () => {
    const o = (upperId: string, lowerId: string) => ({
      key: planOverlapKey(upperId, lowerId),
      upperId,
      lowerId,
      gap: 1,
    });
    expect(
      collectPlanHiddenIds([o('a', 'b'), o('c', 'b'), o('b', 'd')]),
    ).toEqual(['b', 'd']);
  });
});

