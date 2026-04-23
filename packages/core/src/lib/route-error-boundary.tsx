import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RestClientError, RestClientTimeoutError } from '../api/errors';

interface RouteErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    if (import.meta.env?.DEV) {
      console.error('[RouteErrorBoundary]', error, info);
    }
  }

  reset = () => {
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
