import {
  useCallback,
  useMemo,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  rulerPlacementFromPoints,
  type RulerPlacement,
} from '@crane/domain/3d';
import type { Vector3Tuple } from '@crane/core/types/math';
import { isRulerDrawClick, snapRulerPoint } from '../lib/ruler-editor';

interface UseRulerDrawParams {
  /** 그리기 모드. 꺼지면 찍어 둔 시작점을 버린다. */
  active: boolean;
  /** 화면 좌표 → 바닥 점(use-scene-drop 의 드롭 raycast). 못 찾으면 null. */
  resolvePoint: (clientX: number, clientY: number) => Vector3Tuple | null;
  /** 이동 스냅 단위. 0 이면 스냅 없음. */
  snapStep: number;
  /** 마지막 pointerdown — 클릭과 드래그(카메라 조작)를 가른다. */
  lastPointerDownRef: RefObject<{ clientX: number; clientY: number } | null>;
  onDraw: (placement: RulerPlacement) => void;
}

/**
 * 눈금 그리기 — 캔버스 루트의 클릭 두 번으로 시작점·끝점을 받는다.
 *
 * 누른 채 끌기가 아닌 이유: 왼쪽 드래그는 마퀴, 가운데·오른쪽 드래그는 카메라
 * 라서 겹치고, 긴 레일은 시작점을 찍은 뒤 카메라를 옮겨 끝점을 찍어야 한다.
 *
 * 클릭은 **캡처 단계**에서 받아 전파를 끊는다 — R3F 의 클릭(모델 선택·
 * onPointerMissed 의 선택 해제)과 라벨 DOM 의 클릭이 함께 돌지 않게 한다.
 * 포인터 이벤트는 건드리지 않으므로 카메라 조작은 그대로다.
 *
 * 미리보기는 이 훅의 상태일 뿐 씬 데이터에 들어가지 않는다. 히스토리에는
 * onDraw 가 부르는 추가 한 번만 남는다.
 */
export function useRulerDraw({
  active,
  resolvePoint,
  snapStep,
  lastPointerDownRef,
  onDraw,
}: UseRulerDrawParams) {
  const [start, setStart] = useState<Vector3Tuple | null>(null);
  const [hover, setHover] = useState<Vector3Tuple | null>(null);

  // 모드가 바뀌면 찍어 둔 점을 버린다. effect 안 setState 대신 렌더 중 이전
  // 값과 비교해 조정한다(palette-placed-objects 의 선례).
  const [trackedActive, setTrackedActive] = useState(active);
  if (trackedActive !== active) {
    setTrackedActive(active);
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
      if (!active || event.button !== 0) return;
      event.stopPropagation();
      if (!isRulerDrawClick(lastPointerDownRef.current, event)) return;
      const point = resolveSnapped(event.clientX, event.clientY);
      if (!point) return;
      if (!start) {
        setStart(point);
        setHover(null);
        return;
      }
      // 같은 자리를 다시 찍었으면(길이 0) 무시하고 끝점을 계속 기다린다.
      const placement = rulerPlacementFromPoints(start, point);
      if (placement) onDraw(placement);
    },
    [active, lastPointerDownRef, onDraw, resolveSnapped, start],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!active || !start) return;
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
    [active, resolveSnapped, start],
  );

  const preview = useMemo(
    () => (start && hover ? rulerPlacementFromPoints(start, hover) : null),
    [start, hover],
  );

  return {
    /** 시작점을 찍었는지 — 안내 문구가 "시작점"과 "끝점"을 가른다. */
    hasStart: active && start !== null,
    preview: active ? preview : null,
    handleClickCapture,
    handlePointerMove,
  };
}
