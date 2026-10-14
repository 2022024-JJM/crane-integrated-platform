import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RestClientError, RestClientTimeoutError } from '../api/errors';
import {
  autoResetDelayMs,
  claimChunkReload,
  isChunkLoadError,
} from './route-error-recovery';

interface RouteErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/**
 * 라우트 에러 바운더리 — 무인 관제용 자동 복구.
 *
 * - 에러마다 지수 백오프(`autoResetDelayMs`)로 스스로 리셋한다. 연속 실패
 *   횟수는 성공적으로 렌더된 뒤 다음 에러까지 유지되어 폭주를 막는다.
 * - 동적 import(청크) 실패는 리셋으로 안 낫는다(재배포 뒤 옛 index.html) —
 *   `claimChunkReload` 간격 안에서 한 번 새로 고친다.
 * - "다시 시도" 버튼은 그대로 — 사람이 있으면 바로 누를 수 있다.
 */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null };
  private attempts = 0;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    console.error('[RouteErrorBoundary]', error, info.componentStack);
    if (
      isChunkLoadError(error) &&
      typeof window !== 'undefined' &&
      claimChunkReload(
        Date.now(),
        typeof sessionStorage !== 'undefined' ? sessionStorage : null,
      )
    ) {
      window.location.reload();
      return;
    }
    this.attempts += 1;
    this.scheduleReset(autoResetDelayMs(this.attempts));
  }

  componentWillUnmount() {
    this.clearResetTimer();
  }

  private clearResetTimer() {
    if (this.resetTimer !== null) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  private scheduleReset(delayMs: number) {
    this.clearResetTimer();
    this.resetTimer = setTimeout(() => {
      this.resetTimer = null;
      this.setState({ error: null });
    }, delayMs);
  }

  reset = () => {
    this.clearResetTimer();
    this.attempts = 0;
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return <DefaultRouteErrorFallback error={error} onRetry={this.reset} />;
  }
}

function getErrorMessage(error: Error): { title: string; detail: string } {
  if (error instanceof RestClientTimeoutError) {
    return {
      title: '요청 시간 초과',
      detail: '서버 응답이 지연되고 있습니다. 네트워크 상태를 확인해주세요.',
    };
  }
  if (error instanceof RestClientError) {
    if (error.status >= 500) {
      return {
        title: '서버 오류',
        detail: `서버가 응답하지 못했습니다. (status ${error.status})`,
      };
    }
    if (error.status === 404) {
      return {
        title: '요청한 리소스를 찾을 수 없습니다',
        detail: `경로를 확인해주세요. (status ${error.status})`,
      };
    }
    return {
      title: '요청 처리 실패',
      detail: `${error.message} (status ${error.status})`,
    };
  }
  return {
    title: '화면을 표시하는 중 문제가 발생했습니다',
    detail: error.message || '알 수 없는 오류가 발생했습니다.',
  };
}

function DefaultRouteErrorFallback({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const { title, detail } = getErrorMessage(error);
  return (
    <div
      role="alert"
      className="flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-md text-sm">{detail}</p>
      <button
        type="button"
        onClick={onRetry}
        className="border-border bg-background hover:bg-accent mt-2 rounded-md border px-4 py-2 text-sm font-medium"
      >
        다시 시도
      </button>
    </div>
  );
}
