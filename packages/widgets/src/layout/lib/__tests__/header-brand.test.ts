import { describe, expect, it } from 'vitest';
import type { UserRole } from '@crane/features/auth';
import { getHeaderBrandKeys } from '../header-brand';

const DEFAULT_KEYS = {
  primary: 'header.brandPrimary',
  accent: 'header.brandAccent',
};
const INDOORSHOP_KEYS = {
  primary: 'header.brandIndoorshopPrimary',
  accent: 'header.brandIndoorshopAccent',
};

describe('getHeaderBrandKeys', () => {
  it('Indoorshop.IT(indoorshop) 는 내업 문구를 쓴다', () => {
    expect(getHeaderBrandKeys('indoorshop')).toEqual(INDOORSHOP_KEYS);
  });

  it('Indoorshop.OT(indoorshop-ot) 는 내업 문구를 쓴다', () => {
    expect(getHeaderBrandKeys('indoorshop-ot')).toEqual(INDOORSHOP_KEYS);
  });

  it('Indoorshop.Keyin(keyin) 은 요청 범위 밖이라 기본 문구를 유지한다', () => {
    expect(getHeaderBrandKeys('keyin')).toEqual(DEFAULT_KEYS);
  });

  it.each<UserRole>([
    'philly',
    'ocean',
    'goliath',
    'mro',
    'mro2',
    'hmi',
    'hmi2',
  ])('나머지 역할(%s)은 기본 문구를 유지한다', (role) => {
    expect(getHeaderBrandKeys(role)).toEqual(DEFAULT_KEYS);
  });

  it('로그인 전(undefined)에는 기본 문구를 쓴다', () => {
    expect(getHeaderBrandKeys(undefined)).toEqual(DEFAULT_KEYS);
  });

  it('알 수 없는 역할이 들어와도 기본 문구로 떨어진다', () => {
    expect(getHeaderBrandKeys('unknown' as UserRole)).toEqual(DEFAULT_KEYS);
  });

  it('같은 역할은 같은 키 객체를 돌려준다 (불필요한 리렌더 방지)', () => {
    expect(getHeaderBrandKeys('indoorshop')).toBe(
      getHeaderBrandKeys('indoorshop-ot'),
    );
    expect(getHeaderBrandKeys('ocean')).toBe(getHeaderBrandKeys(undefined));
  });
});
