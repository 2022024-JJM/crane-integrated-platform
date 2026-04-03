import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../atoms/button';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <AppErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

function AppErrorFallback({
  error,
  onReset,
}: {
  error: Error | null;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">
            {t('common:errorBoundary.title', {
              defaultValue: 'An unexpected error occurred',
            })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('common:errorBoundary.description', {
              defaultValue:
                'Something went wrong while rendering this page. Please try again.',
            })}
          </p>
        </div>

        {error?.message ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left">
            <p className="font-mono text-xs text-muted-foreground break-all">
              {error.message}
            </p>
          </div>
        ) : null}

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="size-4" />
            {t('common:errorBoundary.retry', { defaultValue: 'Try again' })}
          </Button>
          <Button
            onClick={() => {
              window.location.href = '/';
            }}
          >
            {t('common:errorBoundary.goHome', {
              defaultValue: 'Go to Dashboard',
            })}
          </Button>
        </div>
      </div>
    </div>
  );
}
