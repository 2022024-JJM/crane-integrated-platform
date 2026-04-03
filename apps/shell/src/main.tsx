import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { AppRuntimeEffects } from './runtime/app-runtime-effects';
import './i18n-init';
import './styles/global.css';
import { QueryProvider } from '@crane/core/providers';
import { AppErrorBoundary } from '@crane/ui/organisms/app-error-boundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryProvider>
        <AppRuntimeEffects />
        <App />
      </QueryProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
