import { createId } from '@crane/core/lib/create-id';
import type {
  CameraSensorSettings,
  LidarSensorSettings,
  SavedCameraSensorInfo,
  SavedLidarSensorInfo,
} from '../model/sensor-types';
import type { Vector3Tuple } from '@crane/core/types/math';

// ===== LIDAR =====

export const DEFAULT_LIDAR_HORIZONTAL_FOV = 360;
export const DEFAULT_LIDAR_VERTICAL_FOV = 60;
export const DEFAULT_LIDAR_FAR = 8;
export const DEFAULT_LIDAR_HORIZONTAL_SEGMENTS = 48;
export const DEFAULT_LIDAR_VERTICAL_SEGMENTS = 12;
export const DEFAULT_LIDAR_POINT_SIZE = 0.055;

export const MIN_LIDAR_FOV = 1;
export const MAX_LIDAR_FOV = 360;
export const MIN_LIDAR_FAR = 0;
export const MIN_LIDAR_SEGMENTS = 1;
export const MAX_LIDAR_SEGMENTS = 64;
export const MIN_LIDAR_POINT_SIZE = 0.01;
export const MAX_LIDAR_POINT_SIZE = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampLidarFov(value: number) {
  return clamp(value, MIN_LIDAR_FOV, MAX_LIDAR_FOV);
}
export function clampLidarSegments(value: number) {
  return clamp(Math.round(value), MIN_LIDAR_SEGMENTS, MAX_LIDAR_SEGMENTS);
}
export function clampLidarPointSize(value: number) {
  return clamp(value, MIN_LIDAR_POINT_SIZE, MAX_LIDAR_POINT_SIZE);
}

export function normalizeLidarSettings<T extends LidarSensorSettings>(
  settings: T,
): T {
  const horizontalFov = clampLidarFov(settings.horizontalFov);
  const verticalFov = clampLidarFov(settings.verticalFov);
  const far = Number.isFinite(settings.far) ? settings.far : MIN_LIDAR_FAR;
  const pointSize = Number.isFinite(settings.pointSize)
    ? settings.pointSize
    : MIN_LIDAR_POINT_SIZE;
  return {
    ...settings,
    horizontalFov,
    verticalFov,
    far: Math.max(MIN_LIDAR_FAR, far),
    horizontalSegments: clampLidarSegments(settings.horizontalSegments),
    verticalSegments: clampLidarSegments(settings.verticalSegments),
    pointSize: clampLidarPointSize(pointSize),
  };
}

export function createLidarSensor(
  position: Vector3Tuple,
): SavedLidarSensorInfo {
  return {
    id: createId(),
    type: 'lidar',
    name: 'LiDAR',
    position,
    rotation: [0, 0, 0],
    horizontalFov: DEFAULT_LIDAR_HORIZONTAL_FOV,
    verticalFov: DEFAULT_LIDAR_VERTICAL_FOV,
    far: DEFAULT_LIDAR_FAR,
    horizontalSegments: DEFAULT_LIDAR_HORIZONTAL_SEGMENTS,
    verticalSegments: DEFAULT_LIDAR_VERTICAL_SEGMENTS,
    pointSize: DEFAULT_LIDAR_POINT_SIZE,
  };
}

// ===== CAMERA =====

export const DEFAULT_CAMERA_HORIZONTAL_FOV = 92;
export const DEFAULT_CAMERA_VERTICAL_FOV = 60;
export const DEFAULT_CAMERA_NEAR = 0.35;
export const DEFAULT_CAMERA_FAR = 6;
export const DEFAULT_CAMERA_FRUSTUM_SEGMENTS_X = 10;
export const DEFAULT_CAMERA_FRUSTUM_SEGMENTS_Y = 6;

export const MIN_CAMERA_FOV = 1;
export const MAX_CAMERA_FOV = 180;
export const MIN_CAMERA_NEAR = 0;
export const MIN_CAMERA_GRID_SEGMENTS = 1;
export const MAX_CAMERA_GRID_SEGMENTS = 32;

export function clampCameraFov(value: number) {
  return clamp(value, MIN_CAMERA_FOV, MAX_CAMERA_FOV);
}
export function clampCameraGridSegments(value: number) {
  return clamp(
    Math.round(value),
    MIN_CAMERA_GRID_SEGMENTS,
    MAX_CAMERA_GRID_SEGMENTS,
  );
}

export function normalizeCameraSettings<T extends CameraSensorSettings>(
  settings: T,
): T {
  const horizontalFov = clampCameraFov(settings.horizontalFov);
  const verticalFov = clampCameraFov(settings.verticalFov);
  const near = Number.isFinite(settings.near) ? settings.near : 0;
  const far = Number.isFinite(settings.far) ? settings.far : near;
  const normalizedNear = Math.max(MIN_CAMERA_NEAR, near);
  const normalizedFar = Math.max(normalizedNear + MIN_CAMERA_NEAR, far);
  return {
    ...settings,
    horizontalFov,
    verticalFov,
    near: normalizedNear,
    far: normalizedFar,
    frustumSegmentsX: clampCameraGridSegments(settings.frustumSegmentsX),
    frustumSegmentsY: clampCameraGridSegments(settings.frustumSegmentsY),
  };
}

export function createCameraSensor(
  position: Vector3Tuple,
): SavedCameraSensorInfo {
  return {
    id: createId(),
    type: 'camera',
    name: 'Camera',
    position,
    rotation: [0, 0, 0],
    horizontalFov: DEFAULT_CAMERA_HORIZONTAL_FOV,
    verticalFov: DEFAULT_CAMERA_VERTICAL_FOV,
    near: DEFAULT_CAMERA_NEAR,
    far: DEFAULT_CAMERA_FAR,
    frustumSegmentsX: DEFAULT_CAMERA_FRUSTUM_SEGMENTS_X,
    frustumSegmentsY: DEFAULT_CAMERA_FRUSTUM_SEGMENTS_Y,
  };
}
