import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface UseSceneUnsavedChangesGuardParams {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => Promise<boolean>;
}

/** 미저장 이탈 다이얼로그에서 사용자가 고른 선택지. */
export type SceneUnsavedChoice = 'save' | 'discard' | 'stay';

export interface SceneUnsavedChangesPrompt {
  /** 다이얼로그를 띄워야 하는지. 사용자 선택을 기다리는 동안 true. */
  open: boolean;
  /** 사용자의 선택을 전달해 대기 중인 네비게이션을 이어간다. */
  choose: (choice: SceneUnsavedChoice) => void;
}

/**
 * 브라우저 경로(`/crane_rnd/monitoring`)를 라우터 경로(`/monitoring`)로 바꾼다.
 *
 * `anchor.href`나 `location.pathname`은 basename을 **포함한** 실제 URL이지만,
 * react-router의 `navigate()`는 basename을 **제외한** 경로를 받아 자기가 다시
 * 앞에 붙인다. 그대로 넘기면 `/crane_rnd/crane_rnd/monitoring`이 되어
 * "요청하신 경로 /crane_rnd는 존재하지 않거나 접근할 수 없습니다"가 뜬다.
 *
 * basename이 빈 문자열인 배포(루트 배포)에서는 그대로 통과한다.
 */
function toRouterPath(pathname: string): string {
  const basename = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  if (!basename || !pathname.startsWith(basename)) {
    return pathname;
  }
  return pathname.slice(basename.length) || '/';
}

export function useSceneUnsavedChangesGuard({
  isDirty,
  isSaving,
  onSave,
}: UseSceneUnsavedChangesGuardParams): {
  unsavedChangesPrompt: SceneUnsavedChangesPrompt;
} {
  const navigate = useNavigate();
  const location = useLocation();
  const isHandlingNavigationRef = useRef(false);
  const ignoreNextPopRef = useRef(false);
  const hasSentinelStateRef = useRef(false);
  // 다이얼로그가 열려 있는 동안 사용자 선택을 기다리는 Promise 의 resolve.
  // null 이면 닫힌 상태. 브라우저 기본 confirm 은 2버튼뿐이라 3분기를 만들려면
  // 두 번 띄워야 했으므로, 커스텀 다이얼로그 한 번으로 선택을 받는다.
  const [pendingResolve, setPendingResolve] = useState<
    ((choice: SceneUnsavedChoice) => void) | null
  >(null);

  useEffect(() => {
    const confirmNavigation = async (): Promise<boolean> => {
      const choice = await new Promise<SceneUnsavedChoice>((resolve) => {
        setPendingResolve(() => resolve);
      });

      try {
        if (choice === 'save') {
          // 저장이 끝날 때까지 다이얼로그를 열어 둔다(버튼은 isSaving 으로 비활성).
          // 저장 실패(false)면 머무른다 — 실패 toast 는 persistence 쪽에서 띄운다.
          return await onSave();
        }

        return choice === 'discard';
      } finally {
        setPendingResolve(null);
      }
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

      // anchor.href는 basename을 포함한 실제 URL이고 location.pathname은
      // 라우터 경로(basename 제외)라 그대로 비교하면 같은 페이지를 눌러도
      // 항상 "다른 경로"로 판정된다. 라우터 경로 기준으로 맞춰서 비교한다.
      const nextRouterPath = toRouterPath(nextUrl.pathname);

      if (
        nextUrl.origin !== window.location.origin ||
        (nextRouterPath === location.pathname &&
          nextUrl.search === location.search &&
          nextUrl.hash === location.hash)
      ) {
        return;
      }

      event.preventDefault();
      isHandlingNavigationRef.current = true;

      void confirmNavigation()
        .then((shouldProceed) => {
          if (shouldProceed) {
            navigate(`${nextRouterPath}${nextUrl.search}${nextUrl.hash}`);
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

    history.pushState({ __sceneUnsavedGuard: true }, '', window.location.href);
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

  return {
    unsavedChangesPrompt: {
      open: pendingResolve !== null,
      choose: (choice) => pendingResolve?.(choice),
    },
  };
}
