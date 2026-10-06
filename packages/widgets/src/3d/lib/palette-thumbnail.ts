import { withBaseUrl } from '@crane/core/lib/asset-url';
import type { ScenePaletteEntry } from '@crane/features/asset-library';

/**
 * 라이브러리에 저장된 썸네일의 주소 — 팔레트의 모델·지도·배경 타일이 같이
 * 쓴다. 썸네일은 자산마다 같은 경로(`thumbnails/<id>.png`)에 덮어써지므로
 * 저장 시각(`stamp`)을 쿼리로 붙여 다시 찍은 그림의 캐시를 깬다.
 *
 * 썸네일이 없으면 undefined — 타일은 종류 아이콘(모델은 런타임 미리보기)을
 * 놓는다.
 */
export function toPaletteThumbnailUrl(
  thumbnail: ScenePaletteEntry['thumbnail'],
): string | undefined {
  if (!thumbnail) return undefined;
  const url = withBaseUrl(thumbnail.path);
  if (!thumbnail.stamp) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${encodeURIComponent(thumbnail.stamp)}`;
}
