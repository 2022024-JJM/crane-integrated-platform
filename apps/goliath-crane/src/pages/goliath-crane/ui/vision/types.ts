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
] as const;

export type CameraChannel = (typeof CAMERA_CHANNELS)[number];

export type ExpandedView =
  | { type: 'camera'; id: string }
  | { type: 'lidar' }
  | null;
