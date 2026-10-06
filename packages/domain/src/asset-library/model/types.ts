import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 3D 자산 라이브러리 스키마.
 *
 * 자산(AssetRecord)은 불변 id 와 가변 메타데이터, 그리고 **추가만 되는 버전
 * 목록**으로 이뤄진다. 메타데이터를 고쳐도 버전은 생기지 않고, 파일을 바꾸면
 * 반드시 새 버전이 된다. "현재 버전" 은 버전 목록을 가리키는 포인터라 롤백은
 * 포인터를 옮기는 것이고 파일은 건드리지 않는다.
 *
 * 저장소(파일·브라우저·향후 서버)와 무관한 모양이다 — 파일 위치는
 * AssetFileRef 로 간접 참조한다.
 */

/**
 * 자산 종류. `model`·`map` 은 씬에 놓는 3D 자산(GLB)이고, `environment` 는 씬의
 * 배경(등장방형 파노라마 EXR)이다. `drawing`(보는 도면: PDF·그림)과 `cad`(CAD
 * 원본: DWG·DXF·STEP …)는 씬에 놓지 않는 문서형 자산이다.
 */
export const ASSET_KINDS = [
  'model',
  'map',
  'environment',
  'drawing',
  'cad',
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** 형상이 있는 자산(GLB)인가 — 기하 통계·권장 상한·씬 배치가 있다. */
export function isGeometryAssetKind(kind: AssetKind): boolean {
  return kind === 'model' || kind === 'map';
}

/**
 * 3D 화면 편집에서 씬에 쓰는 자산인가(모델·지도·배경) — 편집 팔레트에 나오고
 * 배치 속성을 가진다.
 */
export function isSceneAssetKind(kind: AssetKind): boolean {
  return kind === 'model' || kind === 'map' || kind === 'environment';
}

/** 문서형 자산인가 — 씬에 배치하지 않고 기하 통계가 없으며 도면 번호·리비전을 가진다. */
export function isDocumentAssetKind(kind: AssetKind): boolean {
  return kind === 'drawing' || kind === 'cad';
}

/**
 * 버전 상태. 새 버전은 항상 draft 로 시작하고 전이는
 * lib/asset-versions.ts 의 표만 따른다.
 */
export const ASSET_VERSION_STATUSES = [
  'draft',
  'in-review',
  'approved',
  'rejected',
  'published',
  'withdrawn',
] as const;
export type AssetVersionStatus = (typeof ASSET_VERSION_STATUSES)[number];

/**
 * 파일 위치. `public` 은 배포 정적 파일(절대 경로), `browser` 는 서버가 없는
 * 운영 환경에서 이 브라우저의 IndexedDB 에만 있는 파일(저장소 키)이다 —
 * 운영에서는 자산을 등록할 수 없어 버전 파일은 전부 `public` 이고, `browser`
 * 는 그 브라우저에서 찍은 썸네일에만 쓰인다.
 */
export type AssetFileRef =
  | { storage: 'public'; path: string }
  | { storage: 'browser'; key: string };

export interface AssetFile {
  ref: AssetFileRef;
  /** 저장된 파일명(확장자 포함). */
  fileName: string;
  /** 소문자 확장자. */
  format: string;
  /** 바이트 크기. 배포 파일은 통계 표에서 채우므로 null 일 수 있다. */
  sizeBytes: number | null;
  /**
   * `sha256:<hex>` 또는 `fnv:<hex>`. 중복 감지·무결성 확인용. 올린 **원본**의
   * 해시다 — 최적화해 저장한 파일의 해시가 아니다(같은 원본을 다시 올리는 것을
   * 알아보려는 값이라).
   */
  contentHash: string | null;
  /**
   * 등록할 때 최적화해 저장했으면 올린 원본의 바이트 크기. 없으면 올린 그대로다.
   * `sizeBytes` 는 저장된(최적화된) 파일의 크기다.
   */
  originalSizeBytes?: number;
}

/** GLB 한 개의 기하 통계. 크기(size)는 모델 고유 단위다. */
export interface AssetStats {
  triangles: number;
  vertices: number;
  meshes: number;
  materials: number;
  textures: number;
  drawCalls: number;
  nodes: number;
  textureMemoryBytes: number;
  size: Vector3Tuple | null;
  /** LOD 단계 수. LOD 가 없으면 1. */
  lodLevels: number;
  animations: number;
}

export interface AssetVersion {
  /** 1 부터 시작하는 선형 번호. 재사용하지 않는다. */
  version: number;
  status: AssetVersionStatus;
  file: AssetFile;
  /** 변경 메모. */
  note: string;
  /** 도면 리비전 표기(A, B, P01 …). 버전 번호와 별개의 층이다. */
  revision?: string;
  /** ISO 시각. 알 수 없으면 빈 문자열. */
  createdAt: string;
  createdBy: string;
  stats?: AssetStats;
}

export const ASSET_HISTORY_ACTIONS = [
  'created',
  'metadata',
  'status',
  'version-added',
  'version-removed',
  'current-changed',
  'thumbnail',
] as const;
export type AssetHistoryAction = (typeof ASSET_HISTORY_ACTIONS)[number];

export interface AssetHistoryEntry {
  id: string;
  at: string;
  actor: string;
  action: AssetHistoryAction;
  version?: number;
  /** status·current-changed 의 이전/이후 값. */
  from?: string;
  to?: string;
  /** metadata 에서 바뀐 필드 이름들. */
  fields?: string[];
}

export interface AssetThumbnail {
  ref: AssetFileRef;
  updatedAt: string;
}

/**
 * 지도의 역할 — 씬 스키마의 SceneMapRole 과 같은 값이다(이 슬라이스는 씬
 * 스키마를 import 하지 않아 따로 적는다). `ground` 는 바닥, `context` 는 주변
 * 지형.
 */
export const ASSET_MAP_ROLES = ['ground', 'context'] as const;
export type AssetMapRole = (typeof ASSET_MAP_ROLES)[number];

/**
 * 배치 속성 — 3D 화면 편집에서 이 자산을 씬에 놓을 때의 기본값. 놓는 순간
 * 씬에 복사되고 그 뒤로는 씬이 자기 값을 가진다(이미 놓인 것은 바뀌지 않는다).
 * 값이 없는 항목은 기본 동작이다.
 */
export interface AssetPlacement {
  /**
   * 모델·지도·배경 — 편집 팔레트에 내지 않는다. 화면 코드가 직접 불러 쓰는
   * 부품처럼 씬에 놓을 일이 없는 자산용이다. true 만 저장한다.
   */
  paletteHidden?: boolean;
  /** 지도 — 역할. 없으면 `ground`(바닥). */
  mapRole?: AssetMapRole;
  /** 지도 — 추가할 때의 초기 위치. 없으면 원점. */
  defaultPosition?: Vector3Tuple;
}

export interface AssetRecord {
  id: string;
  kind: AssetKind;
  name: string;
  description: string;
  /**
   * 종류 안의 세부 분류(indoor·crane·okpo …). 탐색 계층의 체크박스가 이 값으로
   * 좁힌다.
   */
  categories: string[];
  owner: string;
  /** 씬에 놓을 때의 기본값(모델·지도). 전부 기본 동작이면 필드가 없다. */
  placement?: AssetPlacement;
  /** 도면 번호. */
  drawingNo?: string;
  /** 연결된 자산(도면 ↔ 모델). */
  relatedAssetIds: string[];
  versions: AssetVersion[];
  currentVersion: number;
  thumbnail?: AssetThumbnail;
  createdAt: string;
  updatedAt: string;
  history: AssetHistoryEntry[];
}

export interface AssetCollection {
  id: string;
  name: string;
  assetIds: string[];
}

/**
 * 문서의 스키마 버전. 필드 이름이 바뀌면 올린다 — 옛 코드가 새 문서를 읽으면
 * 모르는 필드를 떨군 채 저장해 내용이 사라지므로, 옛 코드는 자기보다 새
 * 문서를 읽기를 거부한다(`assertReadableAssetLibraryDocument`).
 *
 * 2: 자산의 카테고리 필드가 `categories` 다. 1 은 같은 값을 `tags` 로 적었고,
 * 읽을 때 올린다(`sanitize-asset-library.ts`).
 */
export const ASSET_LIBRARY_SCHEMA_VERSION = 2;

export interface AssetLibraryDocument {
  schemaVersion: typeof ASSET_LIBRARY_SCHEMA_VERSION;
  assets: AssetRecord[];
  collections: AssetCollection[];
}

/** 배포 파일 통계 표 — 키는 public 절대 경로. */
export interface AssetStatsTableEntry {
  /** 측정 당시 파일의 콘텐츠 해시(자산 해시 매니페스트와 같은 형식). */
  hash: string;
  bytes: number;
  stats?: AssetStats;
}
export type AssetStatsTable = Record<string, AssetStatsTableEntry>;

export const ASSET_NAME_MAX = 80;
export const ASSET_DESCRIPTION_MAX = 2000;
export const ASSET_NOTE_MAX = 500;
export const ASSET_CATEGORY_MAX = 24;
export const ASSET_CATEGORIES_MAX = 20;
export const ASSET_OWNER_MAX = 60;
export const ASSET_REVISION_MAX = 12;
export const ASSET_DRAWING_NO_MAX = 60;
export const ASSET_RELATED_MAX = 50;
export const ASSET_VERSIONS_MAX = 500;
export const ASSET_HISTORY_MAX = 200;
export const ASSET_COLLECTIONS_MAX = 100;
export const ASSET_COLLECTION_NAME_MAX = 40;
