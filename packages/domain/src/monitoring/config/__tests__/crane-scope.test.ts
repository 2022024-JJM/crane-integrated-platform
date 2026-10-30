import { describe, expect, it } from 'vitest';
import { getCraneScopeByRegion } from '../crane-scope';

describe('getCraneScopeByRegion', () => {
  it('옥포·필리 도크는 외업, dock-in 은 내업', () => {
    expect(getCraneScopeByRegion('dock-1')).toBe('outdoor');
    expect(getCraneScopeByRegion('dock-2')).toBe('outdoor');
    expect(getCraneScopeByRegion('philly-dock-2')).toBe('outdoor');
    expect(getCraneScopeByRegion('dock-in')).toBe('indoor');
  });

  it('미등록 region 은 기본 범위로 대체하지 않고 null', () => {
    expect(getCraneScopeByRegion('')).toBeNull();
    expect(getCraneScopeByRegion('dock-3')).toBeNull();
    expect(getCraneScopeByRegion('DOCK-1')).toBeNull();
    // 프로토타입 키를 region 으로 오인하지 않는다.
    expect(getCraneScopeByRegion('toString')).toBeNull();
    expect(getCraneScopeByRegion('__proto__')).toBeNull();
  });
});
