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
 * 자산 종류. `model`·`map` 은 씬에 놓는 3D 자산(GLB)이고, `drawing`(보는 도면:
 * PDF·그림)과 `cad`(CAD 원본: DWG·DXF·STEP …)는 씬에 놓지 않는 문서형 자산이다.
 */
export const ASSET_KINDS = ['model', 'map', 'drawing', 'cad'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** 문서형 자산인가 — 씬에 배치하지 않고 기하 통계가 없으며 도면 번호·리비전을 가진다. */
export function isDocumentAssetKind(kind: AssetKind): boolean {
  return kind === 'drawing' || kind === 'cad';
}

/** 조선소. 자산의 `sites` 가 비어 있으면 전사 공용이다. */
export const ASSET_SITES = ['okpo', 'philly'] as const;
export type AssetSiteId = (typeof ASSET_SITES)[number];

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

/** builtin = 코드 카탈로그·배포 파일에서 온 자산, user = 이 화면에서 등록한 자산. */
export type AssetOrigin = 'builtin' | 'user';

/**
 * 파일 위치. `public` 은 배포 정적 파일(절대 경로), `browser` 는 서버가 없는
 * 운영 환경에서 이 브라우저의 IndexedDB 에만 있는 파일(저장소 키)이다.
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
  /** `sha256:<hex>` 또는 `fnv1a64:<hex>`. 중복 감지·무결성 확인용. */
  contentHash: string | null;
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

export interface AssetRecord {
  id: string;
  kind: AssetKind;
  origin: AssetOrigin;
  name: string;
  description: string;
  /** 자유 분류(indoor·outdoor·ground·context·runtime …). */
  category: string;
  sites: AssetSiteId[];
  tags: string[];
  owner: string;
  /** 씬 편집기 카탈로그 id. 있으면 팔레트에서 배치할 수 있는 자산이다. */
  catalogId?: string;
  /** 씬에 놓을 때의 기본 스케일 — 고유 단위를 m 로 바꾸는 배율이기도 하다. */
  defaultScale: Vector3Tuple;
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

export const ASSET_LIBRARY_SCHEMA_VERSION = 1;

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

/** 코드 카탈로그·배포 파일에서 온 자산의 원천 정보. */
export interface BuiltinAssetSource {
  id: string;
  kind: AssetKind;
  name: string;
  /** public 절대 경로. */
  path: string;
  category: string;
  catalogId?: string;
  defaultScale?: Vector3Tuple;
  sites?: AssetSiteId[];
  tags?: string[];
  description?: string;
}

export const ASSET_NAME_MAX = 80;
export const ASSET_DESCRIPTION_MAX = 2000;
export const ASSET_NOTE_MAX = 500;
export const ASSET_TAG_MAX = 24;
export const ASSET_TAGS_MAX = 20;
export const ASSET_OWNER_MAX = 60;
export const ASSET_CATEGORY_MAX = 40;
export const ASSET_REVISION_MAX = 12;
export const ASSET_DRAWING_NO_MAX = 60;
export const ASSET_RELATED_MAX = 50;
export const ASSET_VERSIONS_MAX = 500;
export const ASSET_HISTORY_MAX = 200;
export const ASSET_COLLECTIONS_MAX = 100;
export const ASSET_COLLECTION_NAME_MAX = 40;
