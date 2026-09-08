import {
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
} from 'react';

/**
 * 포털(툴팁·팝오버·컨텍스트 메뉴·셀렉트)이 붙을 컨테이너를 내려보내는 컨텍스트.
 *
 * base-ui 포털은 기본으로 `document.body`에 렌더되는데, `requestFullscreen()`으로
 * 특정 요소만 브라우저 top layer에 올린 상태에서는 그 요소 바깥의 DOM이 z-index와
 * 무관하게 위로 올라오지 못해 팝업이 보이지 않는다. 전체화면 루트(ThreeSceneViewer 등)가
 * 자기 ref를 제공하면 그 안의 포털 컴포넌트가 전부 루트 안에 렌더된다.
 *
 * 값이 없으면 `undefined`를 돌려줘 base-ui 기본(body)을 그대로 쓴다.
 *
 * 제공하는 ref는 마운트 동안 바꾸지 말 것. 팝업이 열려 있거나 닫히는 중에
 * 컨테이너가 바뀌면 base-ui가 팝업을 리마운트하면서 닫힘 완료를 감지하지 못해
 * 팝업이 화면에 남는다(ThreeSceneViewer의 주석 참고).
 */
type PortalContainerRef = RefObject<HTMLElement | null>;

const PortalContainerContext = createContext<PortalContainerRef | null>(null);

interface PortalContainerProviderProps {
  /** 포털 대상 요소 ref. null이면 하위 포털이 기본(body)으로 돌아간다. */
  container: PortalContainerRef | null;
  children: ReactNode;
}

function PortalContainerProvider({
  container,
  children,
}: PortalContainerProviderProps) {
  return (
    <PortalContainerContext.Provider value={container}>
      {children}
    </PortalContainerContext.Provider>
  );
}

function usePortalContainer(): PortalContainerRef | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}

export { PortalContainerProvider, usePortalContainer };
