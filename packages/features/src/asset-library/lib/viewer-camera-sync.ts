import type { Vector3Tuple } from '@crane/core/types/math';
import type { FramingBounds } from './viewer-framing';

/**
 * 뷰어 카메라 맞물림 — 두 버전을 나란히 볼 때 한쪽을 돌리면 다른 쪽도 같은
 * 각도·같은 확대로 따라온다.
 *
 * 두 버전의 크기가 다를 수 있으므로 카메라 자세를 그대로 복사하지 않는다.
 * 물체의 경계(중심·반지름)에 대한 **상대 자세**로 바꿔 건네고, 받는 쪽이
 * 자기 물체의 경계로 되돌린다. 크기가 달라도 화면 속 구도가 같다.
 */

export interface CameraPose {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

/** 경계에 대한 상대 자세. 길이는 전부 경계 구 반지름의 배수다. */
export interface RelativeCameraPose {
  /** 대상 → 카메라 방향(단위 벡터). */
  direction: Vector3Tuple;
  /** 카메라-대상 거리 / 반지름. */
  distance: number;
  /** (대상 − 경계 중심) / 반지름. */
  targetOffset: Vector3Tuple;
}

interface Sphere {
  center: Vector3Tuple;
  radius: number;
}

function toSphere(bounds: FramingBounds): Sphere {
  return {
    center: [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ],
    radius:
      0.5 *
        Math.hypot(
          bounds.max[0] - bounds.min[0],
          bounds.max[1] - bounds.min[1],
          bounds.max[2] - bounds.min[2],
        ) || 1,
  };
}

/** 카메라가 대상과 겹쳐 방향을 알 수 없으면 null. */
export function toRelativeCameraPose(
  pose: CameraPose,
  bounds: FramingBounds,
): RelativeCameraPose | null {
  const { center, radius } = toSphere(bounds);
  const offset: Vector3Tuple = [
    pose.position[0] - pose.target[0],
    pose.position[1] - pose.target[1],
    pose.position[2] - pose.target[2],
  ];
  const length = Math.hypot(offset[0], offset[1], offset[2]);
  if (!(length > 0) || !Number.isFinite(length)) return null;
  return {
    direction: [offset[0] / length, offset[1] / length, offset[2] / length],
    distance: length / radius,
    targetOffset: [
      (pose.target[0] - center[0]) / radius,
      (pose.target[1] - center[1]) / radius,
      (pose.target[2] - center[2]) / radius,
    ],
  };
}

export function fromRelativeCameraPose(
  relative: RelativeCameraPose,
  bounds: FramingBounds,
): CameraPose {
  const { center, radius } = toSphere(bounds);
  const target: Vector3Tuple = [
    center[0] + relative.targetOffset[0] * radius,
    center[1] + relative.targetOffset[1] * radius,
    center[2] + relative.targetOffset[2] * radius,
  ];
  const distance = relative.distance * radius;
  return {
    target,
    position: [
      target[0] + relative.direction[0] * distance,
      target[1] + relative.direction[1] * distance,
      target[2] + relative.direction[2] * distance,
    ],
  };
}

export type CameraSyncListener = (
  sourceId: string,
  pose: RelativeCameraPose,
) => void;

export interface ViewerCameraSync {
  publish: CameraSyncListener;
  subscribe: (listener: CameraSyncListener) => () => void;
}

/** 뷰어들이 상대 자세를 주고받는 통로. 보낸 쪽은 받는 쪽이 걸러낸다. */
export function createViewerCameraSync(): ViewerCameraSync {
  const listeners = new Set<CameraSyncListener>();
  return {
    publish: (sourceId, pose) => {
      for (const listener of listeners) listener(sourceId, pose);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
