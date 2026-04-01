import { type RefObject, useEffect, useRef, useState } from 'react';
import type { SceneModelPreviewPreset } from '@/entities/3d';
import {
  acquireRenderer,
  enqueueRender,
  releaseRenderer,
  type AbortHandle,
} from './offscreen-preview-renderer';

type PreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

interface OffscreenPreviewResult {
  imageUrl: string | null;
  status: PreviewStatus;
}

export function useOffscreenPreview(
  path: string,
  preset: SceneModelPreviewPreset | undefined,
  containerRef: RefObject<HTMLElement | null>,
): OffscreenPreviewResult {
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const abortRef = useRef<AbortHandle | null>(null);
  const hasRequestedRef = useRef(false);

  // Acquire/release shared renderer
  useEffect(() => {
    acquireRenderer();
    return () => {
      releaseRenderer();
    };
  }, []);

  // On path/preset change, reset
  useEffect(() => {
    // Cancel any in-flight render for the previous path
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    hasRequestedRef.current = false;
    setImageUrl(null);
    setStatus('idle');
  }, [path, preset]);

  // Intersection observer: trigger render when visible
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasRequestedRef.current) return;

        hasRequestedRef.current = true;
        setStatus('loading');

        const rect = element.getBoundingClientRect();
        const width = Math.max(Math.round(rect.width) || 256, 64);
        const height = Math.max(Math.round(rect.height) || 192, 64);

        const { promise, abort } = enqueueRender({
          path,
          preset,
          width,
          height,
        });
        abortRef.current = abort;

        promise.then(
          (url) => {
            setImageUrl(url);
            setStatus('ready');
            abortRef.current = null;
          },
          (err: unknown) => {
            if (err instanceof Error && err.message === 'aborted') return;
            setStatus('error');
            abortRef.current = null;
          },
        );
      },
      { rootMargin: '100px' },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [containerRef, path, preset]);

  // Cancel in-flight render on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  return { imageUrl, status };
}
