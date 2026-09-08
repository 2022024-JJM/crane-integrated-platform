import type { SceneModelCatalogItem } from '@crane/domain/3d';
import { getModelPreviewAssetPath, withBaseUrl } from '@crane/domain/3d';
import { enqueueRender } from './offscreen-preview-renderer';

/**
 * 정적 썸네일 생성 규격 (dev 전용).
 *
 * 팔레트 타일(5:3 비율)의 약 4배 해상도. 표시 측이 object-contain 이므로
 * 표시 크기와 정확히 일치할 필요는 없지만, 카메라 프레이밍이 렌더 종횡비에
 * 맞춰지므로 타일과 같은 비율을 유지한다.
 */
export const PREVIEW_THUMBNAIL_WIDTH = 320;
export const PREVIEW_THUMBNAIL_HEIGHT = 192;

/**
 * dev 미들웨어(vite.config.ts 의 devPreviewSavePlugin) 엔드포인트.
 * Vite connect 미들웨어는 base(/crane_rnd/) 앞단에서 동작하므로 루트 상대
 * 경로를 그대로 쓴다 (scene-dev-storage 의 /__dev/scene 선례).
 */
const DEV_PREVIEW_API_PATH = '/__dev/preview-thumbnail';

/**
 * 정적 썸네일이 이미 배포돼 있는지 확인한다 (생성 패널의 존재 표시용).
 *
 * dev 서버는 없는 경로에도 SPA fallback 으로 200 + index.html 을 줄 수 있어
 * 상태 코드만으로는 판별할 수 없다. content-type 이 PNG 인지까지 본다.
 */
export async function checkPreviewThumbnailExists(
  catalogItemId: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      withBaseUrl(getModelPreviewAssetPath(catalogItemId)),
      { method: 'HEAD' },
    );
    return (
      response.ok &&
      (response.headers.get('content-type')?.includes('image/png') ?? false)
    );
  } catch {
    return false;
  }
}

/**
 * 카탈로그 항목 하나를 offscreen 렌더러로 렌더해 dev 미들웨어에 저장한다.
 * 실패는 throw — 진행 표시·수집은 호출 측(ui) 책임이다.
 */
export async function generatePreviewThumbnail(
  item: SceneModelCatalogItem,
): Promise<void> {
  const { promise } = enqueueRender({
    path: item.path,
    preset: item.preview,
    width: PREVIEW_THUMBNAIL_WIDTH,
    height: PREVIEW_THUMBNAIL_HEIGHT,
  });
  const blobUrl = await promise;

  const blobResponse = await fetch(blobUrl);
  if (!blobResponse.ok) {
    throw new Error(`Failed to read rendered blob for "${item.id}"`);
  }
  const blob = await blobResponse.blob();

  const saveResponse = await fetch(
    `${DEV_PREVIEW_API_PATH}?${new URLSearchParams({ id: item.id }).toString()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: blob,
    },
  );
  if (!saveResponse.ok) {
    const detail = await saveResponse.text().catch(() => '');
    throw new Error(
      `Failed to save thumbnail for "${item.id}" (${saveResponse.status}): ${detail}`,
    );
  }
}
