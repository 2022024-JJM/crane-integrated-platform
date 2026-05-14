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
 * 으로 두 센서 프레임을 동시에 보내며, 비전 모니터링 그리드에서는 1번 단독 /
 * 2번 단독 / Fusion(모든 활성 센서 합성) 3가지 모드로 노출한다.
 *
 * vendor 중립을 위해 세 종류의 식별자를 분리한다:
 *   - id            : scene channelId. UI/저장 데이터가 참조하는 안정적 키.
 *   - mode          : point-cloud-stream-store 의 PointCloudSensorMode. viewer/HUD prop.
 *   - sensorStoreKey: store sensors Map key. 서버 sensor_name 을 normalizeSensorKey 한 결과.
 *                     서버가 'SOSLAB1' 을 보내는 한 'soslab1' 이지만, 노출되지 않음.
 *
 * 표시명/배지/PiP 헤더/색은 channel entry 한 곳에서 정의해 소비자(lidar-tile,
 * vision-pip, sensor-feed-renderer, viewer HUD)가 동일한 SSOT 를 참조하게 한다.
 */
export const LIDAR_CHANNELS = [
  {
    id: 'lidar-1',
    mode: 'lidar1',
    sensorStoreKey: 'soslab1',
    label: 'LiDAR 1',
    badge: 'LIDAR',
    pipTitle: 'LiDAR 1',
    colorHex: '#5af2ff',
  },
  {
    id: 'lidar-2',
    mode: 'lidar2',
    sensorStoreKey: 'soslab2',
    label: 'LiDAR 2',
    badge: 'LIDAR',
    pipTitle: 'LiDAR 2',
    colorHex: '#ff8a5b',
  },
  {
    id: 'lidar-fusion',
    mode: 'fusion',
    sensorStoreKey: 'fusion',
    label: 'Fusion',
    badge: 'FUSION',
    pipTitle: 'Fusion',
    // fusion 은 모든 활성 센서 합성이라 자체 색은 무의미. 채널 정의 일관성을 위해 둠.
    colorHex: '#a6ff7a',
  },
] as const;

export type LidarChannel = (typeof LIDAR_CHANNELS)[number];
export type LidarMode = LidarChannel['mode'];

/** mode → channel entry. viewer/HUD 가 색·라벨 조회용으로 사용. */
export const LIDAR_BY_MODE: Record<LidarMode, LidarChannel> = {
  lidar1: LIDAR_CHANNELS[0],
  lidar2: LIDAR_CHANNELS[1],
  fusion: LIDAR_CHANNELS[2],
};

/** store sensors Map key → channel entry. store 가 색·라벨 조회용으로 사용. */
export const LIDAR_BY_STORE_KEY: Record<string, LidarChannel> =
  Object.fromEntries(LIDAR_CHANNELS.map((c) => [c.sensorStoreKey, c]));

/** channel id → channel entry. sensor-feed-renderer 가 channelId→mode 매핑에 사용. */
export const LIDAR_BY_CHANNEL_ID: Record<string, LidarChannel> =
  Object.fromEntries(LIDAR_CHANNELS.map((c) => [c.id, c]));

/** 개별 센서 (fusion 제외) 만 그리드/viewer 에 직접 렌더된다. */
export const INDIVIDUAL_LIDAR_CHANNELS = LIDAR_CHANNELS.filter(
  (c) => c.mode !== 'fusion',
) as ReadonlyArray<LidarChannel>;

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
  | { type: 'lidar'; sensor: LidarMode }
  | null;

/**
 * 비전 모니터링 그리드의 소스 필터.
 * - 'lidar': LiDAR 1/2 두 타일 (개별)
 * - 'lidar-fusion': Fusion 합성 타일 1개
 */
export type VisionSourceFilter = 'all' | 'camera' | 'lidar' | 'lidar-fusion';

export const VISION_SOURCE_FILTERS: readonly VisionSourceFilter[] = [
  'all',
  'camera',
  'lidar',
  'lidar-fusion',
] as const;
