import { Outlet } from 'react-router-dom';
import { HeaderDisplaySettingsProvider } from '@/shared/lib/header-display-settings-context';
import { SidebarProvider } from '@/shared/lib/sidebar-context';
import { ThemeProvider } from '@/shared/lib/theme-context';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import { AppToaster } from '@/shared/ui/organisms/app-toaster';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';

export function AppLayout() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <HeaderDisplaySettingsProvider>
          <div className="flex h-screen flex-col overflow-hidden">
            <AppHeader />
            <div className="flex min-h-0 flex-1">
              <AppSidebar />
              <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <Outlet />
                </ScrollArea>
              </main>
            </div>
            <AppToaster />
          </div>
        </HeaderDisplaySettingsProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
