import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface UseSceneUnsavedChangesGuardParams {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => Promise<boolean>;
}

const SAVE_CONFIRM_MESSAGE =
  '저장되지 않은 변경사항이 있습니다. 저장하고 이동할까요?';
const DISCARD_CONFIRM_MESSAGE =
  '저장하지 않고 이동할까요? 취소를 누르면 현재 페이지에 머무릅니다.';

export function useSceneUnsavedChangesGuard({
  isDirty,
  isSaving,
  onSave,
}: UseSceneUnsavedChangesGuardParams) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHandlingNavigationRef = useRef(false);
  const ignoreNextPopRef = useRef(false);
  const hasSentinelStateRef = useRef(false);

  useEffect(() => {
    const confirmNavigation = async () => {
      const shouldSave = window.confirm(SAVE_CONFIRM_MESSAGE);

      if (shouldSave) {
        return await onSave();
      }

      return window.confirm(DISCARD_CONFIRM_MESSAGE);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        !isDirty ||
        isSaving ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        isHandlingNavigationRef.current
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        anchor.getAttribute('href')?.startsWith('mailto:') ||
        anchor.getAttribute('href')?.startsWith('tel:')
      ) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.origin);
      const currentUrl = new URL(
        `${location.pathname}${location.search}${location.hash}`,
        window.location.origin,
      );

      if (
        nextUrl.origin !== currentUrl.origin ||
        (nextUrl.pathname === currentUrl.pathname &&
          nextUrl.search === currentUrl.search &&
          nextUrl.hash === currentUrl.hash)
      ) {
        return;
      }

      event.preventDefault();
      isHandlingNavigationRef.current = true;

      void confirmNavigation()
        .then((shouldProceed) => {
          if (shouldProceed) {
            navigate(
              `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
            );
          }
        })
        .finally(() => {
          isHandlingNavigationRef.current = false;
        });
    };

    const handlePopState = () => {
      if (!isDirty || isSaving) {
        return;
      }

      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }

      isHandlingNavigationRef.current = true;

      void confirmNavigation()
        .then((shouldProceed) => {
          if (shouldProceed) {
            ignoreNextPopRef.current = true;
            navigate(-1);
            return;
          }

          history.pushState(
            { __sceneUnsavedGuard: true },
            '',
            window.location.href,
          );
          hasSentinelStateRef.current = true;
        })
        .finally(() => {
          isHandlingNavigationRef.current = false;
        });
    };

    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [
    isDirty,
    isSaving,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    onSave,
  ]);

  useEffect(() => {
    if (!isDirty || hasSentinelStateRef.current) {
      return;
    }

    history.pushState(
      { __sceneUnsavedGuard: true },
      '',
      window.location.href,
    );
    hasSentinelStateRef.current = true;

    return () => {
      hasSentinelStateRef.current = false;
    };
  }, [isDirty, location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!isDirty) {
      hasSentinelStateRef.current = false;
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);
}
