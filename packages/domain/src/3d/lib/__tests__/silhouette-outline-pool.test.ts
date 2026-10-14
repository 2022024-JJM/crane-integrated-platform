import { describe, expect, it } from 'vitest';
import {
  acquireSilhouetteOutlineMaterial,
  silhouetteOutlineMaterialPoolSize,
} from '../silhouette-outline';

describe('acquireSilhouetteOutlineMaterial', () => {
  it('색·두께가 같으면 같은 머티리얼, 다르면 다른 것, 풀은 그만큼만 자란다', () => {
    const before = silhouetteOutlineMaterialPoolSize();
    const a = acquireSilhouetteOutlineMaterial('#ff0000', 2);
    const b = acquireSilhouetteOutlineMaterial('#ff0000', 2);
    const c = acquireSilhouetteOutlineMaterial('#ff0000', 1.25);
    const d = acquireSilhouetteOutlineMaterial('#ffff00', 2);
    expect(b).toBe(a);
    expect(c).not.toBe(a);
    expect(d).not.toBe(a);
    expect(silhouetteOutlineMaterialPoolSize()).toBe(before + 3);
    expect(a.uniforms.uColor.value.getHexString()).toBe('ff0000');
  });
});
