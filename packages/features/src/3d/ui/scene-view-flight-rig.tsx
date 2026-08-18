import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useSceneViewsStore } from '../model/use-scene-views-store';
import { usePrefersReducedMotion } from '../model/use-prefers-reduced-motion';

/**
 * 씬 뷰 북마크 카메라 리그 — 저장된 뷰 클릭 시 부드러운 카메라 플라이트.
 * collision-guard-camera-rig의 검증된 메커니즘(비행 중 controls 잠금 +
 * 매 프레임 update()로 내부 상태 동기화 → 도착 후 스냅 없음)을 따르되,
 * 트리거가 토글이 아니라 스토어의 flight 요청이다.
 *
 * 비행 중 다른 북마크를 누르면 항상 "현재" 카메라를 시작점으로 새 비행을
 * 시작한다 — 큐잉 없이 부드럽게 방향이 바뀐다.
 */

const FLIGHT_DURATION_S = 1.1;

interface OrbitControlsLike {
  enabled: boolean;
  target: Vector3;
  update: () => void;
}

interface CameraFlight {
  t: number;
  fromPosition: Vector3;
  fromTarget: Vector3;
  toPosition: Vector3;
  toTarget: Vector3;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function SceneViewFlightRig() {
  const activeFlight = useSceneViewsStore((s) => s.activeFlight);
  const clearFlight = useSceneViewsStore((s) => s.clearFlight);
  const reducedMotion = usePrefersReducedMotion();
  const get = useThree((s) => s.get);

  const flightRef = useRef<CameraFlight | null>(null);
  const prevFlightIdRef = useRef<number | null>(null);

  // 플라이트 도중 언마운트되면 컨트롤이 잠긴 채 남지 않도록 복구.
  useEffect(
    () => () => {
      const controls = get().controls as OrbitControlsLike | null;
      if (controls) {
        controls.enabled = true;
      }
    },
    [get],
  );

  useFrame((state, delta) => {
    const camera = state.camera;
    const controls = state.controls as OrbitControlsLike | null;
    if (!controls) return;

    // 요청 감지는 useFrame에서 한다 — 첫 프레임들에서 controls가 아직
    // null일 수 있어 렌더 시점 처리로는 요청을 놓칠 수 있다.
    const flightId = activeFlight?.flightId ?? null;
    if (flightId !== null && flightId !== prevFlightIdRef.current) {
      prevFlightIdRef.current = flightId;

      const toPosition = new Vector3(...activeFlight!.position);
      const toTarget = new Vector3(...activeFlight!.target);

      if (reducedMotion) {
        camera.position.copy(toPosition);
        controls.target.copy(toTarget);
        controls.update();
        clearFlight();
        return;
      }

      controls.enabled = false;
      flightRef.current = {
        t: 0,
        fromPosition: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPosition,
        toTarget,
      };
    }

    const flight = flightRef.current;
    if (!flight) return;

    flight.t = Math.min(1, flight.t + delta / FLIGHT_DURATION_S);
    const eased = easeInOutCubic(flight.t);
    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
    controls.update();

    if (flight.t >= 1) {
      flightRef.current = null;
      controls.enabled = true;
      clearFlight();
    }
  });

  return null;
}
