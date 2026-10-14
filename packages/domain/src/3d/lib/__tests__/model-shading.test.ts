import { describe, expect, it } from 'vitest';
import { resolveMapShading } from '../model-shading';

describe('resolveMapShading', () => {
  it('컨텍스트 지형은 Lambert', () => {
    expect(resolveMapShading({ role: 'context' })).toBe('lambert');
  });

  it('바닥 지도와 역할 없는 지도는 무광 — 지도는 전부 환경이다', () => {
    expect(resolveMapShading({ role: 'ground' })).toBe('matte');
    expect(resolveMapShading({})).toBe('matte');
    expect(resolveMapShading({ role: undefined })).toBe('matte');
  });
});
