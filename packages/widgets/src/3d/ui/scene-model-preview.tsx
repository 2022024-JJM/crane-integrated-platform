import { AlertCircle, Box, Loader2 } from 'lucide-react';
import { Component, type ErrorInfo, memo, type ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SceneModelPreviewPreset } from '@crane/domain/3d';
import { cn } from '@crane/core/lib/utils';
import { useOffscreenPreview } from '../lib/use-offscreen-preview';

interface SceneModelPreviewProps {
  path: string;
  label: string;
  preview?: SceneModelPreviewPreset;
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
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/88 text-center">
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/6',
          tone === 'loading' && 'animate-pulse',
        )}
      >
        <Icon
          className={cn(
            'size-4 text-white/75',
            tone === 'loading' && 'animate-spin',
          )}
        />
      </div>
      <div className="space-y-1 px-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-white/90 uppercase">
          {label}
        </p>
        <p className="text-[11px] text-white/55">{message}</p>
      </div>
    </div>
  );
}

export const SceneModelPreview = memo(function SceneModelPreview({
  path,
  label,
  preview,
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
            'relative h-28 overflow-hidden rounded-[0.95rem] border border-white/10 bg-slate-950/92',
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
  overlayLabel,
  overlayHint,
  showOverlay = false,
  className,
}: SceneModelPreviewProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { imageUrl, status } = useOffscreenPreview(path, preview, containerRef);

  return (
    <div
      ref={containerRef}
      className={cn(
        'pointer-events-none relative h-28 overflow-hidden rounded-[0.95rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_38%),linear-gradient(180deg,#111827_0%,#020617_100%)]',
        className,
      )}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950/85 to-transparent" />
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
      <div
        className={cn(
          'pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-slate-950/82 px-2.5 py-2 text-white transition duration-200',
          showOverlay ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        )}
      >
        {overlayLabel ? (
          <p className="truncate text-[11px] leading-tight font-semibold">
            {overlayLabel}
          </p>
        ) : null}
        {overlayHint ? (
          <p className="mt-0.5 truncate text-[10px] leading-tight text-white/65">
            {overlayHint}
          </p>
        ) : null}
      </div>
      <div className="absolute right-3 bottom-3 left-3 h-3 rounded-full bg-black/30 blur-md" />
      <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/55 px-2 py-1 text-[9px] font-semibold tracking-[0.18em] text-white/85 uppercase">
        <Box className="size-2.5" />
        GLB
      </div>
    </div>
  );
}
