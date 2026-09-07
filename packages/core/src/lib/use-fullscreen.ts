import { useCallback, useEffect, useId } from 'react';
import { create } from 'zustand';

export interface FullscreenControls {
  /** 이 인스턴스가 켠 전체화면이 지금 유효한지. */
  isFullscreen: boolean;
  /** Fullscreen API 를 못 쓰는 환경(iframe 권한 정책 등)이면 false — 버튼을 숨긴다. */
  supported: boolean;
  toggleFullscreen: () => void;
}

interface FullscreenState {
  /** 문서 전체가 전체화면인지(`document.fullscreenElement === documentElement`). */
  documentFullscreen: boolean;
  /** 전체화면을 켠 인스턴스. 문서가 전체화면이 아니면 항상 null. */
  ownerId: string | null;
}

/**
 * 전체화면 전역 상태. Provider 없이 어디서나 구독한다 —
 * AppLayout 은 헤더·사이드바를 숨기려고, 뷰어는 자기가 주인인지
 * 알려고 본다.
 */
const useFullscreenStore = create<FullscreenState>(() => ({
  documentFullscreen: false,
  ownerId: null,
}));

function isDocumentFullscreen() {
  return (
    typeof document !== 'undefined' &&
    document.fullscreenElement === document.documentElement
  );
}

/** `fullscreenchange` 구독은 문서에 하나만 둔다 — 훅 인스턴스 수와 무관. */
let listenerCount = 0;
function handleFullscreenChange() {
  const documentFullscreen = isDocumentFullscreen();
  useFullscreenStore.setState((state) => ({
    documentFullscreen,
    // ESC·F11 로 나갔거나 다른 요소가 전체화면이 되면 주인도 없어진다.
    ownerId: documentFullscreen ? state.ownerId : null,
  }));
}
function subscribeDocument() {
  if (listenerCount === 0) {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  }
  listenerCount += 1;
  return () => {
    listenerCount -= 1;
    if (listenerCount === 0) {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }
  };
}

/**
 * 전체화면 = "문서 전체를 Fullscreen API 로 올리고 앱 헤더·사이드바를
 * 숨긴다". 3D 모니터링 뷰어(`ThreeSceneViewer`)와 3D 편집 페이지가 같이 쓴다.
 *
 * 요소 하나만 `requestFullscreen()` 하지 않는 이유: 그 서브트리만 브라우저
 * top layer 에 올라가서 밖에 있는 DOM — body 포털(툴팁·팝오버·다이얼로그),
 * 앱 전역 Toaster(sonner 는 포털이 아니라 옮길 수도 없다) — 이 z-index 와
 * 무관하게 전부 가려졌다. 전체화면 루트마다 포털 컨테이너와 두 번째 Toaster
 * 를 따로 챙겨야 했고, 루트가 늘 때마다 반복이었다. 문서 전체를 올리면
 * top layer 밖에 남는 것이 없어 그 장치가 전부 필요 없다.
 *
 * 대신 "무엇을 크게 보여줄지" 는 호출측 몫이다 — 페이지를 채우는 화면(편집
 * 페이지)은 AppLayout 이 헤더·사이드바만 숨기면 되고, 페이지 일부인 뷰어는
 * `isFullscreen` 일 때 자기 루트를 `fixed inset-0` 로 띄운다.
 *
 * - 주인(owner)은 toggle 을 부른 인스턴스 하나다. 같은 페이지에 뷰어가
 *   여럿이어도 켠 쪽만 `isFullscreen` 이 true 다.
 * - 상태는 `fullscreenchange` 로만 갱신한다. ESC·F11 로 나가면 우리 코드가
 *   호출되지 않으므로 toggle 결과로 상태를 세우면 어긋난다.
 * - 요청은 사용자 제스처 없이 부르거나 브라우저 정책에 막히면 거부된다.
 *   그 경우 주인을 되돌리고 조용히 넘어간다 — 버튼은 다시 누를 수 있다.
 * - 주인이 언마운트되면(라우트 이동 등) 전체화면을 끝낸다. 주인 없는
 *   전체화면은 헤더·사이드바가 돌아온 채 브라우저만 전체화면인 어정쩡한 상태다.
 */
export function useFullscreen(): FullscreenControls {
  const id = useId();
  const isFullscreen = useFullscreenStore(
    (state) => state.documentFullscreen && state.ownerId === id,
  );

  const supported =
    typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);

  const toggleFullscreen = useCallback(() => {
    if (
      isDocumentFullscreen() &&
      useFullscreenStore.getState().ownerId === id
    ) {
      void document.exitFullscreen().catch(() => {});
      return;
    }

    useFullscreenStore.setState({ ownerId: id });
    void document.documentElement.requestFullscreen().catch(() => {
      useFullscreenStore.setState((state) =>
        state.ownerId === id ? { ownerId: null } : state,
      );
    });
  }, [id]);

  useEffect(() => {
    const unsubscribe = subscribeDocument();
    return () => {
      unsubscribe();
      if (
        isDocumentFullscreen() &&
        useFullscreenStore.getState().ownerId === id
      ) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, [id]);

  return { isFullscreen, supported, toggleFullscreen };
}

/**
 * 누군가 켠 전체화면이 유효한지. AppLayout 이 헤더·사이드바를 숨기는 데
 * 쓴다. 주인이 없는 문서 전체화면(우리 코드가 켠 게 아닌 것)은 false.
 */
export function useIsFullscreenActive(): boolean {
  useEffect(() => subscribeDocument(), []);
  return useFullscreenStore(
    (state) => state.documentFullscreen && state.ownerId !== null,
  );
}

/** 테스트 전용 — 스토어와 리스너를 초기 상태로 되돌린다. */
export function resetFullscreenStoreForTests() {
  useFullscreenStore.setState({ documentFullscreen: false, ownerId: null });
}
