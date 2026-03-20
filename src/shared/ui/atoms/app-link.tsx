import { forwardRef, type MouseEvent, type MouseEventHandler } from 'react';
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  useHref,
  useLocation,
  type LinkProps,
  type NavLinkProps,
} from 'react-router-dom';
import { useNavigationProgress } from '@/shared/lib/use-navigation-progress';

function shouldHandleNavigation(
  event: MouseEvent<HTMLAnchorElement>,
  target?: string,
) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    (target && target !== '_self') ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  );
}

function useShouldStartNavigation(to: LinkProps['to']) {
  const href = useHref(to);
  const location = useLocation();

  return () => {
    const currentUrl = new URL(
      `${location.pathname}${location.search}${location.hash}`,
      window.location.origin,
    );
    const nextUrl = new URL(href, window.location.origin);

    return !(
      currentUrl.pathname === nextUrl.pathname &&
      currentUrl.search === nextUrl.search
    );
  };
}

export const AppLink = forwardRef<HTMLAnchorElement, LinkProps>(function AppLink(
  { onClick, target, to, ...props },
  ref,
) {
  const { startNavigation } = useNavigationProgress();
  const shouldStartNavigation = useShouldStartNavigation(to);

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event);

    if (!shouldHandleNavigation(event, target) || !shouldStartNavigation()) {
      return;
    }

    startNavigation();
  };

  return (
    <RouterLink
      {...props}
      ref={ref}
      to={to}
      target={target}
      onClick={handleClick}
    />
  );
});

export const AppNavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  function AppNavLink({ onClick, target, to, ...props }, ref) {
    const { startNavigation } = useNavigationProgress();
    const shouldStartNavigation = useShouldStartNavigation(to);

    const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
      onClick?.(event);

      if (!shouldHandleNavigation(event, target) || !shouldStartNavigation()) {
        return;
      }

      startNavigation();
    };

    return (
      <RouterNavLink
        {...props}
        ref={ref}
        to={to}
        target={target}
        onClick={handleClick}
      />
    );
  },
);
