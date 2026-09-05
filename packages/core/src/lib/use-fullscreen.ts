import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

export interface FullscreenControls<T extends HTMLElement> {
  /** 전체화면으로 올릴 요소에 붙인다. */
  rootRef: RefObject<T | null>;
  /** `rootRef` 요소가 현재 전체화면 요소인지. */
  isFullscreen: boolean;
  /** Fullscreen API 를 못 쓰는 환경(iframe 권한 정책 등)이면 false — 버튼을 숨긴다. */
  supported: boolean;
  toggleFullscreen: () => void;
}

/**
 * 한 요소를 브라우저 전체화면(Fullscreen API)으로 띄운다. 3D 모니터링 뷰어
 * (`ThreeSceneViewer`)와 3D 편집 페이지가 같이 쓴다.
 *
 * 앱 안에서 `fixed inset-0` 으로 덮는 방식이 아니라 진짜 전체화면이다 —
 * 그래야 브라우저 탭·주소창까지 걷혀 뷰포트가 실제로 커진다.
 *
 * - 상태는 `fullscreenchange` 로만 갱신한다. ESC·F11 로 나가면 우리 코드가
 *   호출되지 않으므로 toggle 결과로 상태를 세우면 어긋난다.
 * - 요청은 사용자 제스처 없이 부르거나 브라우저 정책에 막히면 거부된다.
 *   그 경우 조용히 넘어간다 — 상태는 false 그대로고 버튼은 다시 누를 수 있다.
 * - 루트 밖 DOM(document.body 포털)은 전체화면 중 top layer 아래에 깔려
 *   보이지 않는다. 호출측이 루트 ref 를 `PortalContainerProvider` 로 내려
 *   툴팁·팝오버·셀렉트·다이얼로그를 루트 안에 렌더해야 한다. 컨테이너는
 *   전체화면 여부와 무관하게 항상 루트로 고정한다 — 도중에 바꾸면 base-ui 가
 *   팝업을 리마운트하면서 닫힘을 놓친다(`portal-container.tsx` 주석).
 */
export function useFullscreen<T extends HTMLElement>(): FullscreenControls<T> {
  const rootRef = useRef<T | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const supported =
    typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    if (document.fullscreenElement === root) {
      void document.exitFullscreen().catch(() => {});
      return;
    }

    void root.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
    };
  }, []);

  return { rootRef, isFullscreen, supported, toggleFullscreen };
}
