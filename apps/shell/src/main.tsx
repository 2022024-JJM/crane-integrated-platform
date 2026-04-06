import { createRoot } from 'react-dom/client';
import { App } from './app';
import { AppRuntimeEffects } from './runtime/app-runtime-effects';
import './i18n-init';
import './styles/global.css';
import { QueryProvider } from '@crane/core/providers';
import { AppErrorBoundary } from '@crane/ui/organisms/app-error-boundary';

// NOTE: StrictMode 비활성화 — React Three Fiber(R3F)의 Canvas 컴포넌트가
// StrictMode의 double-mount와 호환되지 않아 WebGL Context Lost가 발생함.
// Production 빌드에서는 StrictMode가 동작하지 않으므로 영향 없음.
createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <QueryProvider>
      <AppRuntimeEffects />
      <App />
    </QueryProvider>
  </AppErrorBoundary>,
);
