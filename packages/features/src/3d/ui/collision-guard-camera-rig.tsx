import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';
import { useCollisionGuardStore } from '../model/use-collision-guard-store';
import { usePrefersReducedMotion } from '../model/use-prefers-reduced-motion';

/**
 * FSD 카메라 리그 — 충돌 감지 토글과 연동된 시네마틱 카메라 플라이트.
 *
 * 토글 ON: 현재 카메라 포즈를 저장하고 크레인 중심 저고도 포즈로 비행.
 * 토글 OFF: 저장해 둔 포즈로 복귀. 초기 마운트에서는 절대 움직이지
 * 않는다(store enabled 기본값이 true라 페이지 로드 시 카메라를 탈취하면
 * 안 됨 — 씬 저작 카메라 존중).
 *
 * OrbitControls(makeDefault)와의 상호작용:
 *  - 플라이트 중 controls.enabled = false로 입력을 완전히 차단하되,
 *    매 프레임 controls.update()를 호출해 내부 spherical 상태를 카메라에
 *    동기화한다 → 도착 후 재활성화 시 스냅이 없다.
 *  - 도착 후 target은 그대로 두므로 사용자는 잠긴 기준점 주위를 자유롭게
 *    궤도 회전할 수 있다 (FSD의 ego 중심 카메라 감성).
 *  - 플라이트 중 재토글하면 항상 "현재" 카메라를 시작점으로 새 플라이트를
 *    시작한다 — 큐잉 없이 부드럽게 반전된다.
 */

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

export interface CollisionGuardCameraPose {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

interface CollisionGuardCameraRigProps {
  pose: CollisionGuardCameraPose;
  /** 플라이트 시간 (s) */
  duration?: number;
  /**
   * OFF 전환 시 저장해 둔 이전 포즈로 복귀할지 여부. 탑뷰 동기화처럼
   * "카메라 이동 자체가 OFF 트리거"인 구성에서는 복귀 플라이트가 사용자
   * 드래그와 싸우므로 false로 둔다 (ON 진입 프레이밍만 수행).
   */
  restoreOnDisable?: boolean;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function CollisionGuardCameraRig({
  pose,
  duration = 1.1,
  restoreOnDisable = true,
}: CollisionGuardCameraRigProps) {
  const enabled = useCollisionGuardStore((s) => s.enabled);
  const reducedMotion = usePrefersReducedMotion();
  // controls/camera는 useThree 대신 useFrame의 state 인자에서 읽는다 —
  // hook 반환값 mutate 금지(react-hooks/immutability)를 피하면서, drei가
  // makeDefault로 controls를 늦게 등록해도 매 프레임 최신 값을 본다.
  const get = useThree((s) => s.get);

  const flightRef = useRef<CameraFlight | null>(null);
  const savedPoseRef = useRef<{ position: Vector3; target: Vector3 } | null>(
    null,
  );
  const prevEnabledRef = useRef<boolean | null>(null);

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

    // 전환 감지는 useFrame에서 한다 — 첫 프레임들에서 controls가 아직
    // null일 수 있어 렌더 시점 처리로는 전환을 놓칠 수 있다.
    const prev = prevEnabledRef.current;
    if (prev === null) {
      prevEnabledRef.current = enabled;
    } else if (prev !== enabled) {
      prevEnabledRef.current = enabled;

      const beginFlight = (toPosition: Vector3, toTarget: Vector3) => {
        if (reducedMotion) {
          camera.position.copy(toPosition);
          controls.target.copy(toTarget);
          controls.update();
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
      };

      if (enabled) {
        savedPoseRef.current = {
          position: camera.position.clone(),
          target: controls.target.clone(),
        };
        beginFlight(
          new Vector3(...pose.position),
          new Vector3(...pose.target),
        );
      } else if (restoreOnDisable && savedPoseRef.current) {
        const saved = savedPoseRef.current;
        savedPoseRef.current = null;
        beginFlight(saved.position, saved.target);
      } else {
        // 복귀 없음 — 사용자가 움직인 카메라를 그대로 존중한다.
        savedPoseRef.current = null;
        if (flightRef.current) {
          flightRef.current = null;
          controls.enabled = true;
        }
      }
    }

    const flight = flightRef.current;
    if (!flight) return;

    flight.t = Math.min(1, flight.t + delta / duration);
    const eased = easeInOutCubic(flight.t);
    camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
    controls.update();

    if (flight.t >= 1) {
      flightRef.current = null;
      controls.enabled = true;
    }
  });

  return null;
}
