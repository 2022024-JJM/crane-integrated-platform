import { useThree } from '@react-three/fiber';
import {
  useCallback,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  forwardPointerDownToCanvas,
  forwardWheelToCanvas,
  isOverlayDrag,
} from '../lib/overlay-pointer-forwarding';

/**
 * 캔버스 위 DOM 오버레이(라벨)의 휠·드래그를 캔버스로 넘기는 훅 — 수식은
 * lib/overlay-pointer-forwarding.ts. Canvas 안(R3F 트리)에서 부르고, 돌려주는
 * 핸들러를 drei Html 안의 pointer-events 를 받는 요소에 붙인다.
 *
 * - `wheelRef` — 요소 ref 콜백. 네이티브 wheel 리스너를 passive:false 로
 *   건다(React 의 onWheel 은 passive 라 preventDefault 가 안 먹는다). Html 은
 *   별도 React 루트라 useEffect 시점에 요소가 없을 수 있어 ref 콜백을 쓰고,
 *   React 19 의 ref 정리 함수로 뗀다. 여러 요소에 같은 콜백을 붙여도 된다.
 * - `onPointerDown` — 눌린 자리를 기억하고 캔버스에 pointerdown 을 넘긴다.
 *   원본 전파는 lib 가 끊으므로 호출자가 stopPropagation 을 따로 하지 않는다.
 * - `shouldIgnoreClick(event)` — 눌린 자리에서 OVERLAY_CLICK_SLOP_PX 넘게
 *   움직였으면 true(드래그 끝의 click). 호출마다 눌린 자리를 지운다.
 */
export function useOverlayPointerForwarding() {
  const canvas = useThree((state) => state.gl.domElement);
  const downRef = useRef<{ x: number; y: number } | null>(null);

  const wheelRef = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;
      const onWheel = (event: WheelEvent) => {
        forwardWheelToCanvas(event, canvas);
      };
      element.addEventListener('wheel', onWheel, { passive: false });
      return () => {
        element.removeEventListener('wheel', onWheel);
      };
    },
    [canvas],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      downRef.current = { x: event.clientX, y: event.clientY };
      forwardPointerDownToCanvas(event.nativeEvent, canvas);
    },
    [canvas],
  );

  const shouldIgnoreClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const down = downRef.current;
      downRef.current = null;
      return (
        down !== null &&
        isOverlayDrag(down.x, down.y, event.clientX, event.clientY)
      );
    },
    [],
  );

  return { wheelRef, onPointerDown, shouldIgnoreClick };
}
