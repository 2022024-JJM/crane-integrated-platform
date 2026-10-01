import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 자산 뷰어의 카메라 프레이밍 — 경계 상자를 화면에 꽉 차게 담는 포즈를
 * 계산한다. three 없이 튜플만 쓰는 순수 함수다.
 */

export const VIEW_PRESETS = ['iso', 'front', 'right', 'top'] as const;
export type ViewPreset = (typeof VIEW_PRESETS)[number];

/**
 * 프리셋별 시선 방향(대상 → 카메라). 탑뷰는 정수직이 아니라 살짝 기울인다 —
 * 카메라 up 은 항상 +Y 라 정수직에서는 lookAt 이 퇴화한다.
 */
const PRESET_DIRECTIONS: Record<ViewPreset, Vector3Tuple> = {
  iso: [1, 0.72, 1.12],
  front: [0, 0.12, 1],
  right: [1, 0.12, 0],
  top: [0, 1, 0.0015],
};

export interface FramingBounds {
  min: Vector3Tuple;
  max: Vector3Tuple;
}

export interface FramingPose {
  position: Vector3Tuple;
  target: Vector3Tuple;
  /** 카메라-대상 거리. */
  distance: number;
  /** 경계 구 반지름. near/far 를 정하는 기준이다. */
  radius: number;
}

function normalize([x, y, z]: Vector3Tuple): Vector3Tuple {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

/**
 * 경계 구가 세로·가로 화각 중 좁은 쪽에 들어오는 거리에서 바라본다.
 * 구 기준이라 어느 방향에서 봐도 잘리지 않는다. 퇴화한 상자(크기 0)는
 * 반지름 1 로 본다.
 */
export function computeFramingPose(
  bounds: FramingBounds,
  fovDeg: number,
  aspect: number,
  preset: ViewPreset,
  padding = 1.15,
): FramingPose {
  const target: Vector3Tuple = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const radius =
    0.5 *
      Math.hypot(
        bounds.max[0] - bounds.min[0],
        bounds.max[1] - bounds.min[1],
        bounds.max[2] - bounds.min[2],
      ) || 1;

  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const vertical = (Math.min(Math.max(fovDeg, 1), 170) * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * safeAspect);
  const narrow = Math.min(vertical, horizontal);
  const distance = (radius / Math.sin(narrow / 2)) * padding;

  const direction = normalize(PRESET_DIRECTIONS[preset]);
  return {
    position: [
      target[0] + direction[0] * distance,
      target[1] + direction[1] * distance,
      target[2] + direction[2] * distance,
    ],
    target,
    distance,
    radius,
  };
}
