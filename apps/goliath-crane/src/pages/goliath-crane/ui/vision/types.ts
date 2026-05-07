export const CAMERA_CHANNELS = [
  {
    id: 'cam-1',
    label: 'CAM 1',
    descriptionKey: 'visionStrip.cam1',
    connected: true,
  },
  {
    id: 'cam-2',
    label: 'CAM 2',
    descriptionKey: 'visionStrip.cam2',
    connected: true,
  },
  {
    id: 'cam-3',
    label: 'CAM 3',
    descriptionKey: 'visionStrip.cam3',
    connected: false,
  },
  {
    id: 'cam-4',
    label: 'CAM 4',
    descriptionKey: 'visionStrip.cam4',
    connected: false,
  },
  {
    id: 'cam-5',
    label: 'CAM 5',
    descriptionKey: 'visionStrip.cam5',
    connected: false,
  },
  {
    id: 'cam-6',
    label: 'CAM 6',
    descriptionKey: 'visionStrip.cam6',
    connected: false,
  },
  {
    id: 'cam-7',
    label: 'CAM 7',
    descriptionKey: 'visionStrip.cam7',
    connected: false,
  },
  {
    id: 'cam-8',
    label: 'CAM 8',
    descriptionKey: 'visionStrip.cam8',
    connected: false,
  },
  {
    id: 'cam-9',
    label: 'CAM 9',
    descriptionKey: 'visionStrip.cam9',
    connected: false,
  },
  {
    id: 'cam-10',
    label: 'CAM 10',
    descriptionKey: 'visionStrip.cam10',
    connected: false,
  },
  {
    id: 'cam-11',
    label: 'CAM 11',
    descriptionKey: 'visionStrip.cam11',
    connected: false,
  },
  {
    id: 'cam-12',
    label: 'CAM 12',
    descriptionKey: 'visionStrip.cam12',
    connected: false,
  },
] as const;

export type CameraChannel = (typeof CAMERA_CHANNELS)[number];

/**
 * 골리앗 크레인의 LiDAR 채널 목록. 비전 PiP에서는 lidar 타입 단일 처리이지만,
 * 3D 편집 화면 인스펙터에서 센서별로 매핑하기 위해 별도 식별이 필요하다.
 */
export const LIDAR_CHANNELS = [
  { id: 'lidar-1', label: 'LiDAR 1' },
  { id: 'lidar-2', label: 'LiDAR 2' },
] as const;

export type LidarChannel = (typeof LIDAR_CHANNELS)[number];

/**
 * 인스펙터/빌보드/PiP가 공유하는 통합 채널 목록. SceneObjectInspector의
 * VisionChannelOption[] prop으로 그대로 주입할 수 있는 형태.
 */
export const VISION_CHANNELS = [
  ...CAMERA_CHANNELS.map(
    (c) =>
      ({
        id: c.id,
        label: c.label,
        sensorType: 'camera' as const,
      }),
  ),
  ...LIDAR_CHANNELS.map(
    (c) =>
      ({
        id: c.id,
        label: c.label,
        sensorType: 'lidar' as const,
      }),
  ),
] as const;

export type ExpandedView =
  | { type: 'camera'; id: string }
  | { type: 'lidar' }
  | null;
