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
  maps: SavedMapInfo[];
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
  /**
   * 지도 배치 transform. 모두 optional — 기존 저장본(맵에 transform이 없던
   * 시절)은 필드가 없고, 그 경우 원점/무회전/등배로 렌더된다. 즉 이 필드를
   * 건드리지 않은 씬은 이전과 픽셀 단위로 동일하다.
   */
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  /**
   * 편집 잠금. true면 캔버스 클릭·마퀴로 선택되지 않는다 — 지도는 화면
   * 대부분을 덮는 거대 메시라, 잠기지 않으면 다른 객체를 고르려는 클릭이
   * 번번이 지도에 먹힌다. 기본값은 "잠김"(undefined = true 취급)이라
   * 기존 씬의 작업 흐름이 바뀌지 않는다. 해제는 좌측 패널 토글로 한다.
   */
  locked?: boolean;
}

/** 지도 잠금 기본값은 true — 필드 없는 기존 저장본도 잠긴 것으로 본다. */
export function isMapLocked(map: SavedMapInfo): boolean {
  return map.locked !== false;
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
