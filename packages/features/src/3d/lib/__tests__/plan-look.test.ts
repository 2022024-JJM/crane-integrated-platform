import { describe, expect, it } from 'vitest';
import { isPlanLookCamera } from '../plan-look';

describe('isPlanLookCamera', () => {
  it('직교 + 스위치 켬일 때만 true', () => {
    expect(isPlanLookCamera({ isOrthographicCamera: true }, true)).toBe(true);
    expect(isPlanLookCamera({ isOrthographicCamera: true }, false)).toBe(false);
    expect(isPlanLookCamera({ isOrthographicCamera: false }, true)).toBe(false);
    expect(isPlanLookCamera({}, true)).toBe(false);
  });
});
