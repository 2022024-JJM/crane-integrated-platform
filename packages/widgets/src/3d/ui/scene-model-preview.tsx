import { AlertCircle, Loader2 } from 'lucide-react';
import {
  Component,
  type ErrorInfo,
  memo,
  type ReactNode,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { SceneModelPreviewPreset } from '@crane/domain/3d';
import { getModelPreviewAssetPath, withBaseUrl } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { useOffscreenPreview } from '../lib/use-offscreen-preview';

interface SceneModelPreviewProps {
  path: string;
  label: string;
  preview?: SceneModelPreviewPreset;
  /**
   * 카탈로그 id. 있으면 배포된 정적 썸네일(`/previews/{id}.png`)을 먼저
   * 시도하고, 없을 때만(로드 실패 시) 런타임 offscreen 렌더로 폴백한다.
   */
  previewAssetId?: string;
  overlayLabel?: string | null;
  overlayHint?: string | null;
  showOverlay?: boolean;
  className?: string;
}

interface PreviewErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface PreviewErrorBoundaryState {
  hasError: boolean;
}

class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    void _error;
    void _errorInfo;
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function PreviewFallback({
  label,
  message,
  tone = 'loading',
}: {
  label: string;
  message: string;
  tone?: 'loading' | 'error';
}) {
  const Icon = tone === 'loading' ? Loader2 : AlertCircle;

  return (
    <div className="bg-muted/80 absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
      <div
        className={cn(
          'border-border bg-foreground/5 flex size-10 items-center justify-center rounded-2xl border',
          tone === 'loading' && 'animate-pulse',
        )}
      >
        <Icon
          className={cn(
            'text-muted-foreground size-4',
            tone === 'loading' && 'animate-spin',
          )}
        />
      </div>
      <div className="space-y-1 px-3">
        <p className="text-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          {label}
        </p>
        <p className="text-muted-foreground text-[11px]">{message}</p>
      </div>
    </div>
  );
}

export const SceneModelPreview = memo(function SceneModelPreview({
  path,
  label,
  preview,
  previewAssetId,
  overlayLabel,
  overlayHint,
  showOverlay = false,
  className,
}: SceneModelPreviewProps) {
  const { t } = useTranslation();

  return (
    <PreviewErrorBoundary
      fallback={
        <div
          className={cn(
            'border-border bg-muted/60 relative h-28 overflow-hidden rounded-[0.95rem] border',
            className,
          )}
        >
          <PreviewFallback
            label={label}
            message={t('monitoring:palette.previewLoadError')}
            tone="error"
          />
        </div>
      }
    >
      <SceneModelPreviewInner
        path={path}
        label={label}
        preview={preview}
        previewAssetId={previewAssetId}
        overlayLabel={overlayLabel}
        overlayHint={overlayHint}
        showOverlay={showOverlay}
        className={className}
      />
    </PreviewErrorBoundary>
  );
});

function SceneModelPreviewInner({
  path,
  label,
  preview,
  previewAssetId,
  overlayLabel,
  overlayHint,
  showOverlay = false,
  className,
}: SceneModelPreviewProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 정적 썸네일 로드 실패 상태. previewAssetId 가 바뀌면 재시도해야 하므로
  // render 중 prop 변화를 감지해 리셋한다 (React 공식 "adjusting state" 패턴).
  const [prevAssetId, setPrevAssetId] = useState(previewAssetId);
  const [staticFailed, setStaticFailed] = useState(false);
  if (prevAssetId !== previewAssetId) {
    setPrevAssetId(previewAssetId);
    setStaticFailed(false);
  }

  const staticUrl =
    previewAssetId && !staticFailed
      ? withBaseUrl(getModelPreviewAssetPath(previewAssetId))
      : null;

  const { imageUrl, status } = useOffscreenPreview(
    path,
    preview,
    containerRef,
    staticUrl === null,
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'border-border bg-muted/40 pointer-events-none relative h-28 overflow-hidden rounded-[0.95rem] border',
        className,
      )}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      <div className="from-background/60 absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t to-transparent" />
      {staticUrl ? (
        <img
          src={staticUrl}
          alt={label}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
          onError={() => setStaticFailed(true)}
        />
      ) : (
        <>
          {status !== 'ready' ? (
            <PreviewFallback
              label={label}
              message={
                status === 'error'
                  ? t('monitoring:palette.previewLoadError')
                  : t('monitoring:palette.previewLoading')
              }
              tone={status === 'error' ? 'error' : 'loading'}
            />
          ) : null}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={label}
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          ) : null}
        </>
      )}
      <div
        className={cn(
          'bg-popover/90 text-popover-foreground pointer-events-none absolute inset-x-3 bottom-3 rounded-xl px-2.5 py-2 transition duration-200',
          showOverlay ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        )}
      >
        {overlayLabel ? (
          <p className="truncate text-[11px] leading-tight font-semibold">
            {overlayLabel}
          </p>
        ) : null}
        {overlayHint ? (
          <p className="text-muted-foreground mt-0.5 truncate text-[10px] leading-tight">
            {overlayHint}
          </p>
        ) : null}
      </div>
      <div className="absolute right-3 bottom-3 left-3 h-3 rounded-full bg-black/20 blur-md dark:bg-black/35" />
    </div>
  );
}
