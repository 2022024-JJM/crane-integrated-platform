import '@/pages/main/ui/main-page.css';

import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { MainHeader } from '@/pages/main/ui/main-header';
import { MainPageSidebar } from '@/pages/main/ui/main-page-sidebar';
import { SidebarInset, SidebarProvider } from '@/shared/ui/organisms/sidebar';

export function MainPage() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  return (
    <main className="main-page min-h-screen">
      <div className="main-page-overlay" />
      <SidebarProvider
        defaultOpen={false}
        className="relative z-10 flex min-h-screen flex-col"
      >
        <MainHeader />
        <div className="flex min-h-0 flex-1">
          <MainPageSidebar />
          <SidebarInset className="main-page-content flex min-h-0 flex-1 bg-transparent">
            <Outlet />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </main>
  );
}
