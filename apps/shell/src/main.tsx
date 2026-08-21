import { createRoot } from 'react-dom/client';
// 콘텐츠 해시 매니페스트 등록은 어떤 3D 모듈이 URL을 만들기 전에 끝나야 한다.
// import 부작용으로 즉시 실행되도록 최상단에 둔다.
import './runtime/register-asset-hash';
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
