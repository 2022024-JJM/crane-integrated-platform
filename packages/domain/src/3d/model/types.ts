import type { Vector3Tuple } from '@crane/core/types/math';
import type { SavedSensorInfo } from './sensor-types';

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

export interface SavedCameraInfo {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

export interface SavedSceneInfo {
  map: SavedMapInfo | null;
  models: SavedModelInfo[];
  texts?: SavedTextInfo[];
  /**
   * 씬에 배치된 LIDAR / Camera 센서 목록. 각 센서는 sceneInfo 저장에 함께
   * 직렬화되어 새로고침/저장본 로드 시 그대로 복원된다.
   */
  sensors?: SavedSensorInfo[];
  camera?: SavedCameraInfo | null;
}

export interface SavedTextInfo {
  id: string;
  content: string;
  color: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
}

export interface SavedModelInfo {
  id: string;
  equipName: string;
  craneId?: string;
  path: string;
  opacity: number;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  valueMapList: ValueMapItem[];
  /**
   * 자식 mesh 단위 override. 없으면 GLTF 원본 그대로 렌더한다.
   * 사용자가 더블클릭으로 특정 자식 mesh를 선택해 transform/opacity/visible/이름을
   * 편집한 결과가 여기 누적된다.
   */
  meshOverrides?: SavedMeshOverride[];
}

export interface SavedMeshOverride {
  /** ModelMesh가 렌더하는 clone root에서 target mesh까지의 안정 path. */
  meshPath: string;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  opacity?: number;
  visible?: boolean;
  name?: string;
}

export interface SavedMapInfo {
  id: string;
  path: string;
}

export interface ValueMapItem {
  type: ValueMapType;
  key: string;
  /**
   * 단위 변환 계수. position = value * scale.
   * 씬 좌표 = 현실 미터 기준이므로 value 단위가 m이면 1.0,
   * 0.1m(데시미터) 단위이면 0.1로 설정.
   * 생략 시 1.0.
   */
  scale?: number;
  /**
   * 서버 값 0에 대응하는 월드 좌표(해당 축).
   * PLC 반사판 기준값처럼 축마다 기준점이 다를 때 사용.
   * 적용 공식: world_position = offset + value * scale.
   * 생략 시 0.
   */
  offset?: number;
}

export interface SceneModelCatalogItem {
  id: string;
  label: string;
  category: SceneModelCategory;
  path: string;
  defaultScale: Vector3Tuple;
  preview?: SceneModelPreviewPreset;
}

export const SCENE_MODEL_CATEGORIES = [
  'indoor',
  'outdoor',
  'map',
  'etc',
] as const;

export type SceneModelCategory = (typeof SCENE_MODEL_CATEGORIES)[number];

export interface SceneModelPreviewPreset {
  paddingScale?: number;
  verticalOffsetRatio?: number;
  cameraDirection?: Vector3Tuple;
}
