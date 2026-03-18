import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/shared/lib/sidebar-context';
import { ThemeProvider } from '@/shared/lib/theme-context';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';

export function AppLayout() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <div className="flex min-h-screen flex-col">
          <AppHeader />
          <div className="flex flex-1">
            <AppSidebar />
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
