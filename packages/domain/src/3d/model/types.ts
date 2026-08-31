import type { Vector3Tuple } from '@crane/core/types/math';

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
  camera?: SavedCameraInfo | null;
  /**
   * 배경 파노라마(EXR) 카탈로그 id. sceneEnvironmentCatalog의 항목을 가리킨다.
   *
   * - `undefined`: 씬이 배경을 지정하지 않음 → region 기본값으로 떨어진다
   *   (scene-environment-registry). 기존 저장본이 하늘을 잃지 않게 하는 경로다.
   * - `null`: 사용자가 "배경 없음"을 **명시적으로** 고름 → region 기본값도
   *   적용하지 않는다. undefined와 구분되어야 배경을 끌 수 있다.
   */
  environmentId?: string | null;
  /**
   * 조명 설정 — 없으면 전부 기본값(그림자 Off, 태양 남중). 기본값 씬은
   * 이 필드 자체가 직렬화에서 빠져 기존 저장본과 diff가 없다.
   */
  lighting?: SavedLightingInfo;
}

/**
 * 태양 위치 기본값(남중). sanitize·에디터 dirty 판정·UI가 같은 기준을
 * 봐야 하므로 여기서 한 번만 정의한다.
 */
export const SCENE_SUN_POSITION_DEFAULT = 0.5;

export interface SavedLightingInfo {
  /** 그림자 On/Off. 필드 없음 = false (기존 저장본 하위호환). */
  shadows?: boolean;
  /**
   * 태양 위치 0~1. 0=동(+X 지평선) → 0.5=남중(머리 위) → 1=서(-X 지평선).
   * 필드 없음 = 0.5.
   *
   * 방위 규약: **월드 +X = 동**. 씬에 나침반·방위 데이터가 없어 실제 지리
   * 방위를 알 수 없으므로 축 규약으로 못박는다. 태양 궤적 계산은
   * scene-render-preset.tsx가 담당한다.
   */
  sunPosition?: number;
}

export interface SavedTextInfo {
  id: string;
  content: string;
  color: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  /**
   * 편집 잠금 — 씬 데이터다(저장 대상). true면 에디터에서 선택·변형·삭제가
   * 모두 막히고, 계층 목록의 자물쇠 토글로만 풀 수 있다.
   * 필드가 없으면 잠기지 않은 것으로 본다. true일 때만 직렬화해
   * 기존 저장본과의 diff를 최소화한다.
   */
  locked?: boolean;
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
  /**
   * 편집 잠금 — 씬 데이터다(저장 대상). true면 에디터에서 선택·변형·삭제가
   * 모두 막히고, 계층 목록의 자물쇠 토글로만 풀 수 있다.
   * 필드가 없으면 잠기지 않은 것으로 본다. true일 때만 직렬화해
   * 기존 저장본과의 diff를 최소화한다.
   */
  locked?: boolean;
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
   * 표시 이름 — 없으면 path에서 파생한 이름(humanizeModelPath)을 쓴다.
   * 기존 저장본은 필드가 없고, 목록에서 이름을 바꿀 때만 기록된다.
   */
  name?: string;
  /**
   * 지도 배치 transform. 모두 optional — 기존 저장본(맵에 transform이 없던
   * 시절)은 필드가 없고, 그 경우 원점/무회전/등배로 렌더된다. 즉 이 필드를
   * 건드리지 않은 씬은 이전과 픽셀 단위로 동일하다.
   */
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  /**
   * 편집 잠금 — 씬 데이터다(저장 대상). 모델과 달리 **필드가 없으면 잠긴
   * 것**으로 본다: 지도는 화면 대부분을 덮는 거대 메시라 기본이 잠김이어야
   * 다른 객체를 고르려는 클릭이 지도에 먹히지 않고, 기존 저장본(필드 없음)도
   * 종전 UX(항상 잠김 시작) 그대로 열린다. sanitize가 명시적 boolean으로
   * 정규화한다.
   */
  locked?: boolean;
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
  /**
   * 떠 있는 모델 — **배치 전용** 플래그. origin이 흘수선(설계 수면)에 있다는
   * 뜻으로, 드롭 시 bbox 바닥을 지면에 맞추는 대신 origin을 수면(SEA_LEVEL_Y)에
   * 놓는다. 수면 아래 잠김 표현은 이 플래그와 무관하게 바다가 있는 씬의 모든
   * 모델에 적용된다(model-mesh.tsx seaSubmersion).
   */
  floating?: boolean;
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
