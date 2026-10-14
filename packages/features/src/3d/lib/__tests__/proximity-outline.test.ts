import { describe, expect, it } from 'vitest';
import { mergeProximityOutlines } from '../proximity-outline';
import type { ProximityPair } from '../scene-proximity';

const pair = (
  a: string,
  b: string,
  level: 'warn' | 'danger',
): ProximityPair => ({
  key: `${a}|${b}`,
  a,
  b,
  gapM: level === 'danger' ? 3 : 20,
  level,
  from: [0, 0, 0],
  to: [1, 0, 0],
});

describe('mergeProximityOutlines', () => {
  it('상시 윤곽은 none 만 덮고, 상태·근접 외곽선은 그대로 두며, 둘 다 없으면 입력 참조', () => {
    const base = { a: 'commError' as const, b: 'none' as const };
    const out = mergeProximityOutlines(base, [], ['a', 'b', 'c']);
    expect(out).toEqual({ a: 'commError', b: 'contour', c: 'contour' });
    expect(mergeProximityOutlines(base, [], [])).toBe(base);
    expect(
      mergeProximityOutlines(base, [pair('b', 'c', 'danger')], ['b']).b,
    ).toBe('endstop');
  });

  it('쌍이 없으면 입력 참조 그대로', () => {
    const base = { m1: 'none' as const };
    expect(mergeProximityOutlines(base, [])).toBe(base);
  });
  it('주의 → slowdown, 위험 → endstop; 더 위험한 기존 외곽선은 유지, 덜 위험한 것은 덮는다', () => {
    const base = { a: 'commError' as const, b: 'endstop' as const };
    const out = mergeProximityOutlines(base, [
      pair('a', 'b', 'warn'),
      pair('c', 'd', 'danger'),
    ]);
    expect(out).toEqual({
      a: 'slowdown',
      b: 'endstop',
      c: 'endstop',
      d: 'endstop',
    });
    expect(base.a).toBe('commError');
  });
});
