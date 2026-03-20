import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  NavigationType,
  Outlet,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { HeaderDisplaySettingsProvider } from '@/shared/lib/header-display-settings-context';
import { NavigationProgressProvider } from '@/shared/lib/navigation-progress-context';
import { SidebarProvider } from '@/shared/lib/sidebar-context';
import { ThemeProvider } from '@/shared/lib/theme-context';
import { useNavigationProgress } from '@/shared/lib/use-navigation-progress';
import { ScrollArea } from '@/shared/ui/molecules/scroll-area';
import { AppToaster } from '@/shared/ui/organisms/app-toaster';
import { NavigationProgressBar } from '@/shared/ui/organisms/navigation-progress-bar';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';

function NavigationProgressSync() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const { completeNavigation, startNavigation } = useNavigationProgress();
  const hasMountedRef = useRef(false);
  const previousLocationKeyRef = useRef(location.key);
  const popNavigationPendingRef = useRef(false);

  useLayoutEffect(() => {
    if (!hasMountedRef.current) {
      return;
    }

    const didLocationCommit = previousLocationKeyRef.current !== location.key;
    if (!didLocationCommit || navigationType !== NavigationType.Pop) {
      return;
    }

    previousLocationKeyRef.current = location.key;
    popNavigationPendingRef.current = true;
    startNavigation();
  }, [location.key, navigationType, startNavigation]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      previousLocationKeyRef.current = location.key;
      return;
    }

    if (popNavigationPendingRef.current) {
      popNavigationPendingRef.current = false;
      completeNavigation();
      return;
    }

    const didLocationCommit = previousLocationKeyRef.current !== location.key;
    if (didLocationCommit) {
      previousLocationKeyRef.current = location.key;
      completeNavigation();
    }
  }, [completeNavigation, location.key]);

  return null;
}

export function AppLayout() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <HeaderDisplaySettingsProvider>
          <NavigationProgressProvider>
            <NavigationProgressSync />
            <NavigationProgressBar />
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
          </NavigationProgressProvider>
        </HeaderDisplaySettingsProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
