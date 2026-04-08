import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 3D 씬에 배치되는 센서. sensor simulation2 프로젝트에서 가져온
 * LIDAR / Camera 두 종류를 지원한다. 각 센서는 sceneInfo에 같이 저장되어
 * 새로고침/저장본 로드 시 그대로 복원된다.
 */
export type SensorType = 'lidar' | 'camera';

interface BaseSavedSensorInfo {
  id: string;
  name: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
}

export interface LidarSensorSettings {
  /** 수평 시야각(deg). 360이면 wrap-around. */
  horizontalFov: number;
  /** 수직 시야각(deg). */
  verticalFov: number;
  /** 최대 사거리(world units). */
  far: number;
  /** 수평 샘플 분할 개수. */
  horizontalSegments: number;
  /** 수직 샘플 분할 개수. */
  verticalSegments: number;
  /** Point cloud 시각화 점 크기. */
  pointSize: number;
}

export interface SavedLidarSensorInfo extends BaseSavedSensorInfo, LidarSensorSettings {
  type: 'lidar';
}

export interface CameraSensorSettings {
  horizontalFov: number;
  verticalFov: number;
  near: number;
  far: number;
  /** 프러스텀 면 가로 분할 개수. */
  frustumSegmentsX: number;
  /** 프러스텀 면 세로 분할 개수. */
  frustumSegmentsY: number;
}

export interface SavedCameraSensorInfo
  extends BaseSavedSensorInfo,
    CameraSensorSettings {
  type: 'camera';
}

export type SavedSensorInfo = SavedLidarSensorInfo | SavedCameraSensorInfo;

export function isLidarSensor(s: SavedSensorInfo): s is SavedLidarSensorInfo {
  return s.type === 'lidar';
}
export function isCameraSensor(s: SavedSensorInfo): s is SavedCameraSensorInfo {
  return s.type === 'camera';
}
