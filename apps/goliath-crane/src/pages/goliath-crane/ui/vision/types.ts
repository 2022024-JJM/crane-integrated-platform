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
 * 골리앗 크레인의 LiDAR 채널 목록. LiDAR Edge Node Bridge Server 가 한 WebSocket
 * 으로 SOSLAB1/SOSLAB2 두 센서 프레임을 동시에 보내며, 비전 모니터링 그리드에서는
 * 1번 단독 / 2번 단독 / Fusion(둘 다 합성) 3가지 모드로 노출한다.
 *
 * sensorKey 는 point-cloud-stream-store 의 PointCloudSensorMode 와 1:1 매칭된다.
 */
export const LIDAR_CHANNELS = [
  { id: 'soslab-1', label: 'SOSLAB 1', sensorKey: 'soslab1' },
  { id: 'soslab-2', label: 'SOSLAB 2', sensorKey: 'soslab2' },
  { id: 'soslab-fusion', label: 'Fusion', sensorKey: 'fusion' },
] as const;

export type LidarChannel = (typeof LIDAR_CHANNELS)[number];
export type LidarSensorKey = LidarChannel['sensorKey'];

export type ExpandedView =
  | { type: 'camera'; id: string }
  | { type: 'lidar'; sensor: LidarSensorKey }
  | null;

/**
 * 비전 모니터링 그리드의 소스 필터.
 * - 'lidar': SOSLAB1/2 두 타일 (개별)
 * - 'lidar-fusion': Fusion 합성 타일 1개
 */
export type VisionSourceFilter = 'all' | 'camera' | 'lidar' | 'lidar-fusion';

export const VISION_SOURCE_FILTERS: readonly VisionSourceFilter[] = [
  'all',
  'camera',
  'lidar',
  'lidar-fusion',
] as const;
