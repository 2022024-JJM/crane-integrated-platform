import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { computeEdgeShift } from '../lib/edge-shift';

/** 지도 가장자리에서 플레이트를 띄울 여백 — hover 카드의 EDGE_PAD 와 같은 값 */
const EDGE_PAD = 12;
/** 가로 리더가 플레이트 밑변 아래로 파고들 길이 */
const STEM_INSET = 14;

/**
 * 지도 밖으로 걸치는 마커 플레이트를 안쪽으로 밀어 넣는다.
 *
 * 결과를 state 가 아니라 CSS 변수로 DOM 에 직접 쓴다 — 지도를 드래그하는
 * 동안 매 프레임 `bounds_changed` 가 오는데, 여기서 setState 를 하면 마커
 * 전부가 프레임마다 리렌더된다. hover 카드(`useEdgeAwarePlacement`)가 같은
 * 이유로 같은 방식을 쓴다.
 *
 * 반환한 ref 는 마커 루트에 건다. 이동량 계산의 기준이 되는 **밀리기 전**
 * 레이아웃 상자는 그 안의 `[data-marker-plate]` 에서 읽는다 — 실제 이동은
 * 그 안쪽 요소의 transform 이라 바깥 상자의 위치는 오염되지 않는다.
 */
export function useMarkerEdgeShift() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const map = useMap();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const apply = () => {
      const plate = root.querySelector('[data-marker-plate]');
      if (!plate) return;

      const boundsNode = root.closest('[data-map-bounds]');
      const bounds = (
        boundsNode ?? document.documentElement
      ).getBoundingClientRect();
      const plateRect = plate.getBoundingClientRect();

      const { shiftX, leaderWidth, leaderOffset } = computeEdgeShift({
        plateLeft: plateRect.left,
        plateWidth: plateRect.width,
        boundsLeft: bounds.left,
        boundsRight: bounds.right,
        pad: EDGE_PAD,
        stemInset: STEM_INSET,
      });

      root.style.setProperty('--marker-shift-x', `${Math.round(shiftX)}px`);
      root.style.setProperty(
        '--marker-leader-w',
        `${Math.round(leaderWidth)}px`,
      );
      root.style.setProperty(
        '--marker-leader-x',
        `${Math.round(leaderOffset)}px`,
      );
    };

    // `bounds_changed` 는 드래그 중 프레임마다 온다. 그때마다 바로 재면
    // 마커 수만큼 강제 리플로우가 겹치므로 프레임당 한 번으로 모은다.
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };

    // 마운트 직후에는 AdvancedMarker 가 아직 컨테이너를 좌표로 옮기기 전이라
    // 한 프레임 뒤에 한 번 더 잰다.
    apply();
    schedule();

    const listeners = map
      ? [
          map.addListener('bounds_changed', schedule),
          map.addListener('idle', schedule),
        ]
      : [];

    return () => {
      if (frame) cancelAnimationFrame(frame);
      for (const listener of listeners) listener.remove();
    };
  }, [map]);

  return rootRef;
}
