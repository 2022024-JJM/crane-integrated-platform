import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOOK_PICK_RADIUS,
  sanitizeHookNodes,
  sanitizeModelHooks,
} from '../sanitize-model-hooks';

const valid = {
  id: 'hook-upper',
  label: ' Upper ',
  nodes: ['[0]A/[0]Rope_01', '[0]A/[1]Rope_02'],
  attachCode: 'block_attached',
  anchorOffsetY: -0.5,
  pickRadius: 8,
};

describe('sanitizeHookNodes', () => {
  it('빈 문자열·비문자열·중복을 버리고 순서를 지킨다', () => {
    expect(sanitizeHookNodes(['b', '', 3, null, 'a', 'b', undefined])).toEqual([
      'b',
      'a',
    ]);
    expect(sanitizeHookNodes('b')).toEqual([]);
    expect(sanitizeHookNodes(undefined)).toEqual([]);
  });
});

describe('sanitizeModelHooks', () => {
  it('유효 항목은 trim 된 라벨·오프셋·반경까지 보존한다', () => {
    expect(sanitizeModelHooks([valid])).toEqual([
      {
        id: 'hook-upper',
        label: 'Upper',
        nodes: ['[0]A/[0]Rope_01', '[0]A/[1]Rope_02'],
        attachCode: 'block_attached',
        anchorOffsetY: -0.5,
        pickRadius: 8,
      },
    ]);
  });

  it('배열이 아니거나 전부 무효면 undefined (필드 생략)', () => {
    expect(sanitizeModelHooks(undefined)).toBeUndefined();
    expect(sanitizeModelHooks({})).toBeUndefined();
    expect(sanitizeModelHooks([null, 1, 'x', {}])).toBeUndefined();
  });

  it('id 없음·노드 없음·코드 무효(공백·콜론)는 항목째 버린다', () => {
    expect(sanitizeModelHooks([{ ...valid, id: '' }])).toBeUndefined();
    expect(sanitizeModelHooks([{ ...valid, nodes: [] }])).toBeUndefined();
    expect(sanitizeModelHooks([{ ...valid, nodes: 'x' }])).toBeUndefined();
    expect(
      sanitizeModelHooks([{ ...valid, attachCode: 'GC_04:attached' }]),
    ).toBeUndefined();
    expect(
      sanitizeModelHooks([{ ...valid, attachCode: 'a b' }]),
    ).toBeUndefined();
    expect(
      sanitizeModelHooks([{ ...valid, attachCode: '  ' }]),
    ).toBeUndefined();
    expect(sanitizeModelHooks([{ ...valid, attachCode: 7 }])).toBeUndefined();
  });

  it('중복 id 는 첫 항목만(first-wins)', () => {
    const out = sanitizeModelHooks([
      valid,
      { ...valid, label: 'second', pickRadius: 99 },
    ]);
    expect(out).toHaveLength(1);
    expect(out?.[0].label).toBe('Upper');
  });

  it('오프셋 0·NaN·문자열과 반경 0·음수·NaN 은 생략한다', () => {
    const base = { id: 'h', nodes: ['n'], attachCode: 'c' };
    expect(sanitizeModelHooks([{ ...base, anchorOffsetY: 0 }])).toEqual([base]);
    expect(sanitizeModelHooks([{ ...base, anchorOffsetY: NaN }])).toEqual([
      base,
    ]);
    expect(sanitizeModelHooks([{ ...base, anchorOffsetY: '-1' }])).toEqual([
      base,
    ]);
    expect(sanitizeModelHooks([{ ...base, pickRadius: 0 }])).toEqual([base]);
    expect(sanitizeModelHooks([{ ...base, pickRadius: -3 }])).toEqual([base]);
    expect(sanitizeModelHooks([{ ...base, pickRadius: Infinity }])).toEqual([
      base,
    ]);
    expect(sanitizeModelHooks([{ ...base, label: '   ' }])).toEqual([base]);
    expect(DEFAULT_HOOK_PICK_RADIUS).toBeGreaterThan(0);
  });
});
