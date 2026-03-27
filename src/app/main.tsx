import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app';
import { AppRuntimeEffects } from '@/app/runtime/app-runtime-effects';
import '@/shared/config/i18n';
import '@/app/styles/global.css';
import { QueryProvider } from '@/shared/providers';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <AppRuntimeEffects />
      <App />
    </QueryProvider>
  </StrictMode>,
);
