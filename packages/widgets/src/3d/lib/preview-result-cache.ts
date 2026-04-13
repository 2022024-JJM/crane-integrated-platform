import type { RenderRequest } from './preview-render-queue';
import { getRenderRequestKey } from './preview-render-queue';

const PREVIEW_RESULT_CACHE_MAX_SIZE = 64;

const previewResultCache = new Map<string, string>();

export function getCachedPreviewResult(request: RenderRequest): string | null {
  const requestKey = getRenderRequestKey(request);
  const cachedUrl = previewResultCache.get(requestKey);

  if (!cachedUrl) {
    return null;
  }

  previewResultCache.delete(requestKey);
  previewResultCache.set(requestKey, cachedUrl);

  return cachedUrl;
}

export function setCachedPreviewResult(
  request: RenderRequest,
  blobUrl: string,
): void {
  const requestKey = getRenderRequestKey(request);
  const previousUrl = previewResultCache.get(requestKey);

  if (previousUrl && previousUrl !== blobUrl) {
    URL.revokeObjectURL(previousUrl);
  }

  previewResultCache.delete(requestKey);
  previewResultCache.set(requestKey, blobUrl);

  while (previewResultCache.size > PREVIEW_RESULT_CACHE_MAX_SIZE) {
    const oldestKey = previewResultCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    const oldestUrl = previewResultCache.get(oldestKey);
    if (oldestUrl) {
      URL.revokeObjectURL(oldestUrl);
    }
    previewResultCache.delete(oldestKey);
  }
}

export function clearCachedPreviewResults(): void {
  for (const url of previewResultCache.values()) {
    URL.revokeObjectURL(url);
  }

  previewResultCache.clear();
}
