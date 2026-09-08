/**
 * 카탈로그 모델의 정적 미리보기 썸네일 경로.
 *
 * 썸네일은 dev 씬 편집 페이지 모델 탭의 썸네일 생성 패널에서 미리 생성해
 * `apps/shell/public/previews/{id}.png` 로 배포한다(투명 PNG, 테마 중립).
 * 런타임은 이 경로를 먼저 시도하고, 파일이 없으면(신규 모델 등) offscreen
 * WebGL 렌더로 폴백한다.
 *
 * 키를 GLB path 가 아니라 카탈로그 `id` 로 잡는 이유: 렌더 요청 키는 preset
 * 객체가 `[object Object]` 로 직렬화되는 문제로 같은 path 의 preset 차이를
 * 구분하지 못한다. id 는 카탈로그 항목마다 유일하므로 이 문제가 없다.
 *
 * 실제 fetch 시에는 항상 `withBaseUrl()` 을 통과시켜 sub-path 배포와 콘텐츠
 * 해시(`?v=`)를 적용해야 한다.
 */
export function getModelPreviewAssetPath(catalogItemId: string): string {
  return `/previews/${catalogItemId}.png`;
}
