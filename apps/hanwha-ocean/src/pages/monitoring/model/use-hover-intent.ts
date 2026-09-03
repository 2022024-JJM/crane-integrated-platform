import { useCallback, useEffect, useRef } from 'react';

/**
 * 포인터가 마커를 벗어난 뒤 hover 를 실제로 끄기까지 기다리는 시간(ms).
 *
 * 카드와 마커 사이에는 물리적인 틈이 있고, 그 틈을 대각선으로 빠르게 지나가면
 * 한 프레임 정도 둘 다에서 벗어난 상태가 된다. 이 유예가 없으면 사용자가
 * 카드로 마우스를 옮기는 도중에 카드가 사라진다.
 */
const HOVER_CLOSE_DELAY_MS = 140;

/**
 * 마커 hover 를 "의도"로 다룬다 — 진입은 즉시, 이탈은 잠깐 유예한 뒤 반영.
 * 유예 중에 다시 들어오면 취소되므로 카드가 깜빡이지 않는다.
 *
 * 카드 쪽 hover 유지는 이 훅이 아니라 DOM 구조가 담당한다: 카드는 마커
 * content 의 자손이라 `mouseleave` 가 뜨지 않고, 카드와 마커 사이 틈은
 * hover 카드의 투명한 다리(bridge)가 덮는다.
 */
export function useHoverIntent(onChange: (hovered: boolean) => void) {
  const timerRef = useRef<number | null>(null);

  const cancelPendingClose = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancelPendingClose, [cancelPendingClose]);

  const onPointerEnter = useCallback(() => {
    cancelPendingClose();
    onChange(true);
  }, [cancelPendingClose, onChange]);

  const onPointerLeave = useCallback(() => {
    cancelPendingClose();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onChange(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [cancelPendingClose, onChange]);

  return { onPointerEnter, onPointerLeave };
}
