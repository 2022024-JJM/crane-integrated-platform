import { useCallback } from 'react';
import {
  useLocation,
  useNavigate,
  type NavigateOptions,
  type To,
} from 'react-router-dom';
import { useNavigationProgress } from './use-navigation-progress';

function isSameRouteNavigation(to: To, currentUrl: URL) {
  const target =
    typeof to === 'string'
      ? new URL(to, currentUrl)
      : new URL(
          `${to.pathname ?? currentUrl.pathname}${to.search ?? ''}${to.hash ?? ''}`,
          currentUrl,
        );

  return (
    target.pathname === currentUrl.pathname &&
    target.search === currentUrl.search
  );
}

export function useProgressNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { startNavigation } = useNavigationProgress();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        startNavigation();
        navigate(to);
        return;
      }

      const currentUrl = new URL(
        `${location.pathname}${location.search}${location.hash}`,
        window.location.origin,
      );

      if (!isSameRouteNavigation(to, currentUrl)) {
        startNavigation();
      }

      navigate(to, options);
    },
    [location.hash, location.pathname, location.search, navigate, startNavigation],
  );
}
