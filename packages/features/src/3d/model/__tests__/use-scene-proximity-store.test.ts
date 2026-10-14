import { beforeEach, describe, expect, it } from 'vitest';
import type { ProximityPair } from '../../lib/scene-proximity';
import { useSceneProximityStore } from '../use-scene-proximity-store';

function pair(
  key: string,
  level: ProximityPair['level'],
  gapM: number,
): ProximityPair {
  return {
    key,
    a: key + 'a',
    b: key + 'b',
    gapM,
    level,
    from: [0, 0, 0],
    to: [1, 0, 0],
  };
}

describe('useSceneProximityStore', () => {
  beforeEach(() => useSceneProximityStore.getState().clear());

  it('같은 표시면 참조 유지, 간격만 바뀌면 pairs 만, 키·등급이 바뀌면 outlinePairs 도', () => {
    const s = useSceneProximityStore.getState;
    s().setPairs([pair('x', 'warn', 20)]);
    const p1 = s().pairs;
    const o1 = s().outlinePairs;
    expect(o1).toBe(p1);
    s().setPairs([pair('x', 'warn', 20.04)]);
    expect(s().pairs).toBe(p1);
    s().setPairs([pair('x', 'warn', 15)]);
    expect(s().pairs).not.toBe(p1);
    expect(s().outlinePairs).toBe(o1);
    s().setPairs([pair('x', 'danger', 5)]);
    expect(s().outlinePairs).not.toBe(o1);
    expect(s().outlinePairs).toBe(s().pairs);
  });

  it('clear 는 둘 다 비우고, 빈 상태의 clear 는 no-op', () => {
    const s = useSceneProximityStore.getState;
    s().setPairs([pair('x', 'warn', 20)]);
    s().clear();
    expect(s().pairs).toEqual([]);
    expect(s().outlinePairs).toEqual([]);
    const before = s().pairs;
    s().clear();
    expect(s().pairs).toBe(before);
  });
});
