import type { Vector3Tuple } from '@/shared/types/math';

export type ValueMapType =
  | 'PX'
  | 'PY'
  | 'PZ'
  | 'RX'
  | 'RY'
  | 'RZ'
  | 'SX'
  | 'SY'
  | 'SZ';

export interface SavedSceneInfo {
  map: SavedMapInfo;
  models: SavedModelInfo[];
}

export interface SavedModelInfo {
  id: string;
  equipName: string;
  path: string;
  opacity: number;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  valueMapList: ValueMapItem[];
}

export interface SavedMapInfo {
  id: string;
  path: string;
}

export interface ValueMapItem {
  type: ValueMapType;
  key: string;
}

export interface SceneModelCatalogItem {
  id: string;
  label: string;
  path: string;
  defaultScale: Vector3Tuple;
  preview?: SceneModelPreviewPreset;
}

export interface SceneModelPreviewPreset {
  fitScale?: number;
  centerYRatio?: number;
  targetYRatio?: number;
  cameraDistanceMultiplier?: number;
  cameraDirection?: Vector3Tuple;
}
