import type { UserRole } from '@crane/features/auth';

/**
 * 헤더 좌상단 브랜드 문구의 i18n 키 쌍.
 *
 * 디자인은 한 가지다 — 한화 로고 옆에 `primary` 를 기본색으로, `accent` 를
 * 강조색(#f5a623)으로 이어 붙인다. 역할별로 바뀌는 것은 문구뿐이라
 * `app-header.tsx` 는 이 키만 갈아 끼운다.
 */
export interface HeaderBrandKeys {
  primary: string;
  accent: string;
}

const DEFAULT_BRAND: HeaderBrandKeys = {
  primary: 'header.brandPrimary',
  accent: 'header.brandAccent',
};

/**
 * 내업(Indoorshop) 계정 전용 문구.
 *
 * Indoorshop.IT(`indoorshop`)·Indoorshop.OT(`indoorshop-ot`) 두 계정은
 * 크레인 운용이 아니라 내업공정 실적을 보는 화면이라 "CRANE OPS" 를 쓰지
 * 않는다. Indoorshop.Keyin(`keyin`)은 요청 범위 밖이라 기본값을 유지한다.
 */
const INDOORSHOP_BRAND: HeaderBrandKeys = {
  primary: 'header.brandIndoorshopPrimary',
  accent: 'header.brandIndoorshopAccent',
};

const BRAND_BY_ROLE: Partial<Record<UserRole, HeaderBrandKeys>> = {
  indoorshop: INDOORSHOP_BRAND,
  'indoorshop-ot': INDOORSHOP_BRAND,
};

export function getHeaderBrandKeys(
  role: UserRole | undefined,
): HeaderBrandKeys {
  if (!role) return DEFAULT_BRAND;
  return BRAND_BY_ROLE[role] ?? DEFAULT_BRAND;
}
