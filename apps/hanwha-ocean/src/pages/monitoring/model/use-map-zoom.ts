import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import {
  ZOOM_STEP,
  clampZoom,
  ratioToZoom,
  zoomRatio,
} from '../lib/zoom-scale';

export interface MapZoomState {
  /** 트랙 위 0~1 위치. 아직 첫 이벤트 전이면 null */
  ratio: number | null;
  /** 실제로 도달 가능한 최소 줌 (아래 주석 참고) */
  min: number;
  max: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  /** 슬라이더 드래그 — 0~1 위치로 바로 이동 */
  seek: (ratio: number) => void;
}

/**
 * 커스텀 줌 컨트롤이 필요로 하는 것만 지도에서 끌어온다.
 *
 * **유효 최소 줌**: 지도에 `restriction.strictBounds` 가 걸려 있어 세계 전체가
 * 화면에 다 들어오는 지점보다 더 축소할 수 없다. 그 지점은 컨테이너 크기에
 * 따라 달라지므로 `minZoom` 설정값(1)과 다르다. 설정값을 슬라이더 바닥으로
 * 쓰면 트랙 아래쪽이 죽은 구간이 되고 − 버튼도 눌리기만 할 뿐 아무 일이
 * 없다. 그래서 바닥은 지도에게 물어서 정한다 —
 * 관측된 최소 줌을 기억하되, 축소 요청이 반영되지 않으면 그 자리를 새 바닥으로
 * 올려 잡는다(창을 키워 바닥이 올라간 경우가 여기서 스스로 교정된다).
 *
 * 줌 값은 이벤트 콜백에서만 setState 한다. effect 본문에서 `map.getZoom()` 을
 * 읽어 바로 넣으면 react-hooks 의 `set-state-in-effect` 에 걸린다.
 */
export function useMapZoom(minZoom: number, maxZoom: number): MapZoomState {
  const map = useMap();
  const [zoom, setZoom] = useState<number | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  // 직전에 요청한 "더 축소" 목표. 반영 여부로 바닥을 판정한다.
  const requestedDownRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map) return;

    const sync = () => {
      const next = map.getZoom();
      if (next === undefined) return;

      const requested = requestedDownRef.current;
      requestedDownRef.current = null;

      setZoom(next);
      setFloor((current) => {
        // 축소를 요청했는데 거기까지 못 갔다 = 여기가 바닥
        if (requested !== null && next > requested + 0.001) return next;
        if (current === null || next < current) return next;
        return current;
      });
    };

    const listeners = [
      map.addListener('zoom_changed', sync),
      map.addListener('idle', sync),
    ];
    return () => listeners.forEach((listener) => listener.remove());
  }, [map]);

  const applyZoom = useCallback(
    (target: number) => {
      if (!map) return;
      const current = map.getZoom();
      if (current === undefined) return;
      const next = clampZoom(target, minZoom, maxZoom);
      if (next < current) requestedDownRef.current = next;
      map.setZoom(next);
    },
    [map, minZoom, maxZoom],
  );

  const zoomIn = useCallback(() => {
    const current = map?.getZoom();
    if (current === undefined) return;
    applyZoom(current + ZOOM_STEP);
  }, [map, applyZoom]);

  const zoomOut = useCallback(() => {
    const current = map?.getZoom();
    if (current === undefined) return;
    applyZoom(current - ZOOM_STEP);
  }, [map, applyZoom]);

  const effectiveMin = floor ?? minZoom;

  const seek = useCallback(
    (ratio: number) => {
      applyZoom(ratioToZoom(ratio, effectiveMin, maxZoom));
    },
    [applyZoom, effectiveMin, maxZoom],
  );

  return {
    ratio: zoom === null ? null : zoomRatio(zoom, effectiveMin, maxZoom),
    min: effectiveMin,
    max: maxZoom,
    canZoomIn: zoom === null || zoom < maxZoom - 0.001,
    canZoomOut: zoom === null || zoom > effectiveMin + 0.001,
    zoomIn,
    zoomOut,
    seek,
  };
}
