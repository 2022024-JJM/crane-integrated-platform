/**
 * MRO 사이트(도크) 카탈로그 — 목록 섹션/신규 자산 모달/티켓 폼이 공유하는
 * 단일 소스. 현재 조선소에는 4도크만 존재한다. 사이트가 늘어나면 여기에
 * 추가하고 i18n(asset-management:sections.{i18nKey}, sites.{i18nKey})만 붙이면
 * 화면 코드는 수정 없이 반영된다.
 */
export interface SiteInfo {
  id: string;
  /** asset-management 네임스페이스의 sections/sites 하위 키 */
  i18nKey: string;
  /** i18n 미등록 시 표기할 이름 */
  fallbackName: string;
}

export const SITES: SiteInfo[] = [
  { id: 'dock-4', i18nKey: 'dock4', fallbackName: 'Dock No.4' },
];

export function getSiteInfo(siteId: string): SiteInfo | undefined {
  return SITES.find((s) => s.id === siteId);
}
