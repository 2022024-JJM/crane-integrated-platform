import { AppRouterProvider, ThemeProvider } from '@/app/providers';

export function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AppRouterProvider />
    </ThemeProvider>
  );
}
