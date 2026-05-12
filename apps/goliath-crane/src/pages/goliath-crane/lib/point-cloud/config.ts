// monitoring_web 참조 클라이언트 (C:\Users\user\Downloads\monitoring_web)의
// 동작/결과를 100% 동일하게 맞추기 위한 상수들. 시각/네트워크 파라미터를
// 한 곳에 모아 두고, 참조 코드가 변경되더라도 여기서만 따라가면 된다.

export const MAX_POINTS_PER_SENSOR = 60_000;

export const POINT_SIZE_PX = 1.5;

export const STALE_SENSOR_MS = 4_000;

export const INTENSITY_COLOR_RANGE = { min: 0, max: 255 } as const;

export const RECONNECT_BACKOFF_MS = {
  initial: 1_000,
  max: 10_000,
  multiplier: 1.8,
} as const;

export const SENSOR_COLORS = [
  '#5af2ff',
  '#ff8a5b',
  '#a6ff7a',
  '#ffd166',
  '#8fb8ff',
  '#ff6f91',
  '#7ce0c3',
  '#f4a261',
] as const;

export const SCENE_BG = '#07141b';

export const GRID_HELPER = {
  size: 80,
  divisions: 40,
  color1: '#1fb8ff',
  color2: '#123240',
  opacity: 0.22,
} as const;

export const AMBIENT = { color: '#d8f4ff', intensity: 1.6 } as const;

export const CAMERA = {
  fov: 58,
  near: 0.1,
  far: 5_000,
  initialPosition: [12, 8, 14] as const,
};

export const AXES_HELPER_SIZE = 2;

// nginx /lidar/ 프록시 뒤의 LiDAR Edge Node Bridge Server WebSocket path
export const POINT_CLOUD_WS_PATH = 'pointcloud';
