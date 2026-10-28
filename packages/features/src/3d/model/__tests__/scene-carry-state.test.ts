import { beforeEach, describe, expect, it } from 'vitest';
import {
  isCarriedMeshPair,
  isCarriedPair,
  sceneCarryState,
} from '../scene-carry-state';

const HOOK = '[0]Goliath/[1]Trolley_01/[0]Rope_01';

describe('sceneCarryState', () => {
  beforeEach(() => sceneCarryState.clear());

  it('attach/release/carrierOf', () => {
    sceneCarryState.attach('block', 'crane');
    expect(sceneCarryState.carrierOf('block')).toBe('crane');
    expect(sceneCarryState.isCarried('block')).toBe(true);
    expect(sceneCarryState.size).toBe(1);
    sceneCarryState.release('block');
    expect(sceneCarryState.carrierOf('block')).toBeUndefined();
    expect(sceneCarryState.size).toBe(0);
  });

  it('쌍 판정은 순서 무관이고 제3자는 아니다', () => {
    sceneCarryState.attach('block', 'crane');
    expect(isCarriedPair('crane', 'block')).toBe(true);
    expect(isCarriedPair('block', 'crane')).toBe(true);
    expect(isCarriedPair('crane', 'other')).toBe(false);
    expect(isCarriedPair('block', 'block')).toBe(false);
  });

  it('없는 id 의 release 는 no-op, 다른 크레인 재부착은 덮어쓴다', () => {
    sceneCarryState.release('nope');
    expect(sceneCarryState.size).toBe(0);
    sceneCarryState.attach('block', 'crane-a', [HOOK]);
    sceneCarryState.attach('block', 'crane-b');
    expect(sceneCarryState.carrierOf('block')).toBe('crane-b');
    expect(sceneCarryState.size).toBe(1);
    // 덮어쓰면 이전 크레인의 훅 경로는 사라진다.
    expect(isCarriedMeshPair('crane-a', HOOK, 'block', '[0]Body')).toBe(false);
    expect(isCarriedMeshPair('crane-b', HOOK, 'block', '[0]Body')).toBe(false);
  });

  describe('메쉬 쌍 제외(isCarriedMeshPair)', () => {
    it('든 훅 노드 자체와 그 아래 메쉬만 제외하고, 다리·거더는 제외하지 않는다', () => {
      sceneCarryState.attach('block', 'crane', [HOOK]);
      expect(isCarriedMeshPair('crane', HOOK, 'block', '[0]Body')).toBe(true);
      expect(
        isCarriedMeshPair('crane', `${HOOK}/[0]HookBlock`, 'block', '[0]Body'),
      ).toBe(true);
      // 순서 무관
      expect(isCarriedMeshPair('block', '[0]Body', 'crane', HOOK)).toBe(true);
      // 같은 크레인의 다른 메쉬 — 관통으로 본다.
      expect(
        isCarriedMeshPair('crane', '[0]Goliath/[0]Leg', 'block', '[0]Body'),
      ).toBe(false);
      // 경로 접두어만 같은 형제 노드(Rope_01 vs Rope_010)는 아니다.
      expect(isCarriedMeshPair('crane', `${HOOK}0`, 'block', '[0]Body')).toBe(
        false,
      );
      // 다른 모델 쌍
      expect(isCarriedMeshPair('crane', HOOK, 'other', '[0]Body')).toBe(false);
      expect(isCarriedMeshPair('x', HOOK, 'y', '[0]Body')).toBe(false);
    });

    it('같은 크레인의 훅이 더 붙으면(탠덤) 훅 경로가 합쳐지고, 놓으면 전부 사라진다', () => {
      const LOWER = '[0]Goliath/[2]Trolley_02/[0]Rope_01';
      sceneCarryState.attach('block', 'crane', [HOOK]);
      sceneCarryState.attach('block', 'crane', [LOWER]);
      expect(isCarriedMeshPair('crane', HOOK, 'block', '[0]Body')).toBe(true);
      expect(isCarriedMeshPair('crane', LOWER, 'block', '[0]Body')).toBe(true);
      expect(sceneCarryState.size).toBe(1);
      sceneCarryState.release('block');
      expect(isCarriedMeshPair('crane', HOOK, 'block', '[0]Body')).toBe(false);
      expect(isCarriedPair('crane', 'block')).toBe(false);
    });

    it('훅 경로 없이 붙이면 모델 쌍은 운반 중이지만 어떤 메쉬 쌍도 제외되지 않는다', () => {
      sceneCarryState.attach('block', 'crane');
      expect(isCarriedPair('crane', 'block')).toBe(true);
      expect(isCarriedMeshPair('crane', HOOK, 'block', '[0]Body')).toBe(false);
    });
  });
});
