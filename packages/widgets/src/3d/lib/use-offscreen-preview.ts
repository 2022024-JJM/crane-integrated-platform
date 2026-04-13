import { type RefObject, useEffect, useRef, useState } from 'react';
import type { SceneModelPreviewPreset } from '@crane/domain/3d';
import { enqueueRender, type AbortHandle } from './offscreen-preview-renderer';
import {
  getRenderRequestKey,
  type RenderRequest,
} from './preview-render-queue';
import { getCachedPreviewResult } from './preview-result-cache';

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

interface OffscreenPreviewResult {
  imageUrl: string | null;
  status: PreviewStatus;
}

interface PreviewState {
  imageUrl: string | null;
  status: PreviewStatus;
  sourceKey: string;
}

export function useOffscreenPreview(
  path: string,
  preset: SceneModelPreviewPreset | undefined,
  containerRef: RefObject<HTMLElement | null>,
): OffscreenPreviewResult {
  const previewSourceKey = [path, preset ?? 'default'].join('|');
  const [previewState, setPreviewState] = useState<PreviewState>({
    imageUrl: null,
    status: 'idle',
    sourceKey: previewSourceKey,
  });

  const abortRef = useRef<AbortHandle | null>(null);
  const requestedKeyRef = useRef<string | null>(null);

  // On path/preset change, cancel any stale in-flight render.
  useEffect(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    requestedKeyRef.current = null;
  }, [path, preset]);

  // Intersection observer: trigger render when visible
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const requestPreview = () => {
      const rect = element.getBoundingClientRect();
      const request: RenderRequest = {
        path,
        preset,
        width: Math.max(Math.round(rect.width) || 256, 64),
        height: Math.max(Math.round(rect.height) || 192, 64),
      };
      const requestKey = getRenderRequestKey(request);

      if (requestedKeyRef.current === requestKey) {
        return;
      }

      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      const cachedUrl = getCachedPreviewResult(request);
      if (cachedUrl) {
        requestedKeyRef.current = requestKey;
        setPreviewState({
          imageUrl: cachedUrl,
          status: 'ready',
          sourceKey: previewSourceKey,
        });
        return;
      }

      requestedKeyRef.current = requestKey;
      setPreviewState((current) => ({
        imageUrl:
          current.sourceKey === previewSourceKey ? current.imageUrl : null,
        status: 'loading',
        sourceKey: previewSourceKey,
      }));

      const { promise, abort } = enqueueRender(request);
      abortRef.current = abort;

      promise.then(
        (url) => {
          setPreviewState({
            imageUrl: url,
            status: 'ready',
            sourceKey: previewSourceKey,
          });
          abortRef.current = null;
        },
        (err: unknown) => {
          if (err instanceof Error && err.message === 'aborted') return;
          setPreviewState({
            imageUrl: null,
            status: 'error',
            sourceKey: previewSourceKey,
          });
          abortRef.current = null;
        },
      );
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }

        requestPreview();
      },
      { rootMargin: '100px' },
    );

    observer.observe(element);
    requestPreview();

    return () => {
      observer.disconnect();
    };
  }, [containerRef, path, preset, previewSourceKey]);

  // Cancel in-flight render on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  const imageUrl =
    previewState.sourceKey === previewSourceKey ? previewState.imageUrl : null;
  const status =
    previewState.sourceKey === previewSourceKey ? previewState.status : 'idle';

  return { imageUrl, status };
}
