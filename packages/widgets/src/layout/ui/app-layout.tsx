import { useLayoutEffect, useRef, useEffect } from 'react';
import {
  NavigationType,
  Outlet,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { AuthSiteTypeSync } from '@crane/features/auth';
import { HeaderDisplaySettingsProvider } from '@crane/core/lib/header-display-settings-context';
import { NavigationProgressProvider } from '@crane/core/lib/navigation-progress-context';
import { SidebarProvider, useSidebar } from '@crane/core/lib/sidebar-context';
import { SiteTypeProvider } from '@crane/core/lib/site-type-context';
import { ThemeProvider } from '@crane/core/lib/theme-context';
import { useIsFullscreenActive } from '@crane/core/lib/use-fullscreen';
import { useNavigationProgress } from '@crane/core/lib/use-navigation-progress';
import { ScrollArea } from '@crane/ui/molecules/scroll-area';
import { AppToaster } from '@crane/ui/organisms/app-toaster';
import { NavigationProgressBar } from '@crane/ui/organisms/navigation-progress-bar';
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

function SidebarDrawerCloseSync() {
  const { pathname } = useLocation();
  const { close } = useSidebar();

  useEffect(() => {
    // lg 미만(오버레이 드로어)에서만 라우트 변경 시 닫는다 — 데스크톱은 no-op
    if (!window.matchMedia('(min-width: 1024px)').matches) {
      close();
    }
  }, [pathname, close]);

  return null;
}

/**
 * 헤더·사이드바는 전체화면(`useFullscreen`, 문서 전체를 올린다) 중에는
 * 렌더하지 않아 <main> 이 화면을 채운다 — 편집 페이지처럼 페이지를 채우는 화면은
 * 이것만으로 전체화면이 되고, 페이지 일부인 뷰어는 스스로 fixed inset-0
 * 으로 뜬다. Toaster 와 body 포털은 문서 전체가 top layer 에 있으므로 따로
 * 손댈 것이 없다.
 */
function AppHeaderHiddenInFullscreen() {
  const fullscreen = useIsFullscreenActive();
  return fullscreen ? null : <AppHeader />;
}

function AppSidebarHiddenInFullscreen() {
  const fullscreen = useIsFullscreenActive();
  return fullscreen ? null : <AppSidebar />;
}

export function AppLayout() {
  return (
    <ThemeProvider>
      <SiteTypeProvider>
        <SidebarProvider>
          <HeaderDisplaySettingsProvider>
            <NavigationProgressProvider>
              <AuthSiteTypeSync />
              <NavigationProgressSync />
              <SidebarDrawerCloseSync />
              <NavigationProgressBar />
              <div className="flex h-screen flex-col overflow-hidden">
                <AppHeaderHiddenInFullscreen />
                <div className="flex min-h-0 flex-1">
                  <AppSidebarHiddenInFullscreen />
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
      </SiteTypeProvider>
    </ThemeProvider>
  );
}
