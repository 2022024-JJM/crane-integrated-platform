import {
  useCallback,
  useMemo,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  floodlightPlacementFromPoints,
  type FloodlightPlacement,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { isRulerDrawClick, snapRulerPoint } from '../lib/ruler-editor';

/** 배치 모드 — 새 조명 놓기(클릭 두 번) 또는 선택 조명의 조준점 다시 찍기(한 번). */
export type FloodlightPlaceMode = 'place' | 'aim' | null;

interface UseFloodlightPlaceParams {
  mode: FloodlightPlaceMode;
  /** 새 조명의 마스트 높이(씬 unit). */
  height: number;
  /** 화면 좌표 → 바닥 점(use-scene-drop 의 드롭 raycast). 못 찾으면 null. */
  resolvePoint: (clientX: number, clientY: number) => Vector3Tuple | null;
  /** 이동 스냅 단위. 0 이면 스냅 없음. */
  snapStep: number;
  /** 마지막 pointerdown — 클릭과 드래그(카메라 조작)를 가른다. */
  lastPointerDownRef: RefObject<{ clientX: number; clientY: number } | null>;
  onPlace: (placement: FloodlightPlacement) => void;
  onAim: (point: Vector3Tuple) => void;
}

/**
 * 조명(투광등) 배치 — 눈금 그리기(use-ruler-draw)와 같은 캡처 단계 클릭.
 *
 * - `place`: 첫 클릭이 기구를 세울 바닥 자리(그 위로 `height` 만큼 올린다),
 *   두 번째 클릭이 비출 자리다. 같은 자리를 다시 찍으면 바로 아래를 비춘다.
 *   미리보기는 첫 클릭 뒤 마우스를 따라간다.
 * - `aim`: 켜진 동안 마우스를 따라 조준 미리보기(aimHover)가 움직이고 —
 *   새 조명의 두 번째 클릭과 같은 손맛 — 한 번 클릭이 새 조준점이다.
 *
 * 클릭 판정·점 스냅은 눈금과 같은 함수를 쓴다 — 같은 손맛이어야 한다.
 */
export function useFloodlightPlace({
  mode,
  height,
  resolvePoint,
  snapStep,
  lastPointerDownRef,
  onPlace,
  onAim,
}: UseFloodlightPlaceParams) {
  const [start, setStart] = useState<Vector3Tuple | null>(null);
  const [hover, setHover] = useState<Vector3Tuple | null>(null);

  // 모드가 바뀌면 찍어 둔 점을 버린다 — use-ruler-draw 와 같은 렌더 중 보정.
  const [trackedMode, setTrackedMode] = useState(mode);
  if (trackedMode !== mode) {
    setTrackedMode(mode);
    setStart(null);
    setHover(null);
  }

  const resolveSnapped = useCallback(
    (clientX: number, clientY: number) => {
      const point = resolvePoint(clientX, clientY);
      return point ? snapRulerPoint(point, snapStep) : null;
    },
    [resolvePoint, snapStep],
  );

  const handleClickCapture = useCallback(
    (event: MouseEvent) => {
      if (!mode || event.button !== 0) return;
      event.stopPropagation();
      if (!isRulerDrawClick(lastPointerDownRef.current, event)) return;
      const point = resolveSnapped(event.clientX, event.clientY);
      if (!point) return;
      if (mode === 'aim') {
        onAim(point);
        return;
      }
      if (!start) {
        setStart(point);
        setHover(null);
        return;
      }
      const placement = floodlightPlacementFromPoints(start, point, height);
      if (placement) onPlace(placement);
    },
    [height, lastPointerDownRef, mode, onAim, onPlace, resolveSnapped, start],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      // place 는 기구 자리를 찍은 뒤부터, aim 은 켜진 동안 내내 따라간다.
      if (!mode || (mode === 'place' && !start)) return;
      const point = resolveSnapped(event.clientX, event.clientY);
      if (!point) return;
      setHover((prev) =>
        prev &&
        prev[0] === point[0] &&
        prev[1] === point[1] &&
        prev[2] === point[2]
          ? prev
          : point,
      );
    },
    [mode, resolveSnapped, start],
  );

  // 첫 클릭 직후(마우스가 아직 안 움직임)는 바로 아래를 비추는 모양이다.
  const preview = useMemo(
    () => (start ? floodlightPlacementFromPoints(start, hover, height) : null),
    [start, hover, height],
  );

  return {
    /** 기구 자리를 찍었는지 — 안내 문구가 "기구 자리"와 "비출 자리"를 가른다. */
    hasStart: mode === 'place' && start !== null,
    preview: mode === 'place' ? preview : null,
    /** 조준 다시 찍기 중 마우스 아래 바닥 점(스냅 적용) — 콘 미리보기용. */
    aimHover: mode === 'aim' ? hover : null,
    handleClickCapture,
    handlePointerMove,
  };
}
