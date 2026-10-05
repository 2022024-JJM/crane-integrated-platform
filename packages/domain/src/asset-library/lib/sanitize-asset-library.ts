import type { Vector3Tuple } from '@crane/core/types/math';
import {
  ASSET_ID_PATTERN,
  getFileExtension,
} from '../model/asset-library-paths';
import {
  ASSET_COLLECTION_NAME_MAX,
  ASSET_COLLECTIONS_MAX,
  ASSET_DESCRIPTION_MAX,
  ASSET_DRAWING_NO_MAX,
  ASSET_HISTORY_ACTIONS,
  ASSET_HISTORY_MAX,
  ASSET_KINDS,
  ASSET_LIBRARY_SCHEMA_VERSION,
  ASSET_MAP_ROLES,
  ASSET_NAME_MAX,
  ASSET_NOTE_MAX,
  ASSET_OWNER_MAX,
  ASSET_RELATED_MAX,
  ASSET_REVISION_MAX,
  ASSET_CATEGORY_MAX,
  ASSET_CATEGORIES_MAX,
  ASSET_VERSION_STATUSES,
  ASSET_VERSIONS_MAX,
  isSceneAssetKind,
  type AssetCollection,
  type AssetFile,
  type AssetFileRef,
  type AssetHistoryAction,
  type AssetHistoryEntry,
  type AssetKind,
  type AssetLibraryDocument,
  type AssetMapRole,
  type AssetPlacement,
  type AssetRecord,
  type AssetStats,
  type AssetStatsTable,
  type AssetThumbnail,
  type AssetVersion,
  type AssetVersionStatus,
} from '../model/types';

/**
 * 라이브러리 문서의 로드 경계 방어.
 *
 * 원칙은 씬 sanitize 와 같다 — 깨진 항목만 개별로 버리고 나머지는 살린다,
 * 중복은 first-wins, 범위를 벗어난 값은 잘라 맞춘다. 어떤 입력에도 던지지
 * 않는다: 손상된 브라우저 저장본 하나가 페이지 전체를 막으면 안 된다.
 */

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function toCount(value: unknown): number {
  return isFiniteNumber(value) && value > 0 ? Math.floor(value) : 0;
}

/** ISO 로 해석되는 문자열만 통과시킨다. 그 외는 "알 수 없음"(빈 문자열). */
function toTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '';
  return Number.isNaN(Date.parse(value)) ? '' : value;
}

function toVector3(value: unknown): Vector3Tuple | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (!value.every(isFiniteNumber)) return null;
  return [value[0], value[1], value[2]];
}

/** 스키마 1 의 문서가 카테고리를 적던 필드 이름. 읽을 때 `categories` 로 올린다. */
const LEGACY_CATEGORIES_FIELD = 'tags';

export function sanitizeAssetCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const item of value) {
    const category = toText(item, ASSET_CATEGORY_MAX);
    const key = category.toLowerCase();
    if (!category || seen.has(key)) continue;
    seen.add(key);
    categories.push(category);
    if (categories.length >= ASSET_CATEGORIES_MAX) break;
  }
  return categories;
}

/**
 * 경로에 상위 탈출 조각(`..`)이 있는가. 조각 단위로 본다 — 파일 이름 안의
 * 이어진 점(`crane..v2.glb`)은 탈출이 아니다.
 */
function hasParentSegment(path: string): boolean {
  return path.split(/[\\/]/).includes('..');
}

function sanitizeFileRef(value: unknown): AssetFileRef | null {
  if (!isObject(value)) return null;
  if (value.storage === 'public') {
    const path = typeof value.path === 'string' ? value.path : '';
    // public 경로는 `/` 로 시작하는 절대 경로여야 하고 상위 탈출이 없어야 한다.
    if (!path.startsWith('/') || hasParentSegment(path)) return null;
    return { storage: 'public', path };
  }
  if (value.storage === 'browser') {
    const key = typeof value.key === 'string' ? value.key : '';
    if (!key || hasParentSegment(key)) return null;
    return { storage: 'browser', key };
  }
  return null;
}

function sanitizeFile(value: unknown): AssetFile | null {
  if (!isObject(value)) return null;
  const ref = sanitizeFileRef(value.ref);
  if (!ref) return null;
  const location = ref.storage === 'public' ? ref.path : ref.key;
  const fallbackName = location.split('/').pop() ?? '';
  const fileName = toText(value.fileName, 160) || fallbackName;
  return {
    ref,
    fileName,
    format: toText(value.format, 12).toLowerCase() || getFileExtension(fileName),
    sizeBytes:
      isFiniteNumber(value.sizeBytes) && value.sizeBytes >= 0
        ? Math.floor(value.sizeBytes)
        : null,
    contentHash: toText(value.contentHash, 160) || null,
    ...(isFiniteNumber(value.originalSizeBytes) && value.originalSizeBytes > 0
      ? { originalSizeBytes: Math.floor(value.originalSizeBytes) }
      : {}),
  };
}

export function sanitizeAssetStats(value: unknown): AssetStats | undefined {
  if (!isObject(value)) return undefined;
  const size = toVector3(value.size);
  return {
    triangles: toCount(value.triangles),
    vertices: toCount(value.vertices),
    meshes: toCount(value.meshes),
    materials: toCount(value.materials),
    textures: toCount(value.textures),
    drawCalls: toCount(value.drawCalls),
    nodes: toCount(value.nodes),
    textureMemoryBytes: toCount(value.textureMemoryBytes),
    size: size && size.every((n) => n >= 0) ? size : null,
    lodLevels: Math.max(1, toCount(value.lodLevels)),
    animations: toCount(value.animations),
  };
}

function isStatus(value: unknown): value is AssetVersionStatus {
  return ASSET_VERSION_STATUSES.includes(value as AssetVersionStatus);
}

function sanitizeVersion(value: unknown): AssetVersion | null {
  if (!isObject(value)) return null;
  const version = value.version;
  if (!Number.isInteger(version) || (version as number) < 1) return null;
  const file = sanitizeFile(value.file);
  if (!file) return null;
  const revision = toText(value.revision, ASSET_REVISION_MAX);
  const stats = sanitizeAssetStats(value.stats);
  return {
    version: version as number,
    status: isStatus(value.status) ? value.status : 'draft',
    file,
    note: toText(value.note, ASSET_NOTE_MAX),
    ...(revision ? { revision } : {}),
    createdAt: toTimestamp(value.createdAt),
    createdBy: toText(value.createdBy, ASSET_OWNER_MAX),
    ...(stats ? { stats } : {}),
  };
}

function sanitizeVersions(value: unknown): AssetVersion[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const versions: AssetVersion[] = [];
  for (const item of value) {
    const version = sanitizeVersion(item);
    if (!version || seen.has(version.version)) continue;
    seen.add(version.version);
    versions.push(version);
  }
  versions.sort((a, b) => a.version - b.version);
  return versions.slice(0, ASSET_VERSIONS_MAX);
}

function sanitizeHistory(value: unknown): AssetHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: AssetHistoryEntry[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const id = toText(item.id, 80);
    const action = item.action as AssetHistoryAction;
    if (!id || seen.has(id) || !ASSET_HISTORY_ACTIONS.includes(action)) {
      continue;
    }
    seen.add(id);
    const from = toText(item.from, 40);
    const to = toText(item.to, 40);
    // 스키마 1 의 이력은 카테고리 변경을 옛 필드 이름으로 적었다.
    const fields = Array.isArray(item.fields)
      ? [
          ...new Set(
            item.fields
              .filter((f): f is string => typeof f === 'string' && f !== '')
              .map((f) => (f === LEGACY_CATEGORIES_FIELD ? 'categories' : f)),
          ),
        ].slice(0, 20)
      : [];
    entries.push({
      id,
      at: toTimestamp(item.at),
      actor: toText(item.actor, ASSET_OWNER_MAX),
      action,
      ...(Number.isInteger(item.version) && (item.version as number) >= 1
        ? { version: item.version as number }
        : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(fields.length > 0 ? { fields } : {}),
    });
  }
  // 최근 것을 남긴다 — 목록은 시간 오름차순으로 쌓인다.
  return entries.slice(-ASSET_HISTORY_MAX);
}

function sanitizeThumbnail(value: unknown): AssetThumbnail | undefined {
  if (!isObject(value)) return undefined;
  const ref = sanitizeFileRef(value.ref);
  if (!ref) return undefined;
  return { ref, updatedAt: toTimestamp(value.updatedAt) };
}

function sanitizeIdList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !ASSET_ID_PATTERN.test(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
    if (ids.length >= max) break;
  }
  return ids;
}

/**
 * 배치 속성 — 종류에 맞는 항목만, 기본 동작이 아닌 값만 남긴다. 지도의 역할
 * `ground`·원점 위치·false 인 스위치는 "값 없음" 과 같은 동작이라 싣지 않는다
 * (같은 상태가 두 모양으로 저장되면 수정 이력이 헛돈다). 씬에 쓰지 않는 종류
 * (도면·CAD)이거나 남는 것이 없으면 undefined 다.
 */
export function sanitizeAssetPlacement(
  value: unknown,
  kind: AssetKind,
): AssetPlacement | undefined {
  if (!isObject(value) || !isSceneAssetKind(kind)) return undefined;
  const placement: AssetPlacement = {};
  if (value.paletteHidden === true) placement.paletteHidden = true;
  if (kind === 'map') {
    if (
      ASSET_MAP_ROLES.includes(value.mapRole as AssetMapRole) &&
      value.mapRole !== 'ground'
    ) {
      placement.mapRole = value.mapRole as AssetMapRole;
    }
    const position = toVector3(value.defaultPosition);
    if (position && position.some((n) => n !== 0)) {
      placement.defaultPosition = position;
    }
  }
  if (kind === 'model' && value.floating === true) {
    placement.floating = true;
  }
  return Object.keys(placement).length > 0 ? placement : undefined;
}

export function sanitizeAssetRecord(value: unknown): AssetRecord | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === 'string' ? value.id : '';
  if (!ASSET_ID_PATTERN.test(id)) return null;
  if (!ASSET_KINDS.includes(value.kind as AssetKind)) return null;
  const versions = sanitizeVersions(value.versions);
  // 버전이 하나도 없으면 가리킬 파일이 없다 — 자산으로 성립하지 않는다.
  if (versions.length === 0) return null;

  const hasCurrent = versions.some((v) => v.version === value.currentVersion);
  const kind = value.kind as AssetKind;
  const thumbnail = sanitizeThumbnail(value.thumbnail);
  const placement = sanitizeAssetPlacement(value.placement, kind);
  const drawingNo = toText(value.drawingNo, ASSET_DRAWING_NO_MAX);

  // 옛 문서의 `origin`·`catalogId`·`defaultScale` 은 읽지 않는다 — 코드
  // 카탈로그가 없어져 뜻이 없고, 다음 저장에서 사라진다.
  return {
    id,
    kind,
    name: toText(value.name, ASSET_NAME_MAX) || id,
    description: toText(value.description, ASSET_DESCRIPTION_MAX),
    // 스키마 1 의 문서는 같은 값을 옛 필드에 적었다. 둘 다 있으면 새 필드다.
    categories: sanitizeAssetCategories(
      Array.isArray(value.categories)
        ? value.categories
        : value[LEGACY_CATEGORIES_FIELD],
    ),
    owner: toText(value.owner, ASSET_OWNER_MAX),
    ...(placement ? { placement } : {}),
    ...(drawingNo ? { drawingNo } : {}),
    relatedAssetIds: sanitizeIdList(value.relatedAssetIds, ASSET_RELATED_MAX)
      .filter((related) => related !== id),
    versions,
    currentVersion: hasCurrent
      ? (value.currentVersion as number)
      : versions[versions.length - 1].version,
    ...(thumbnail ? { thumbnail } : {}),
    createdAt: toTimestamp(value.createdAt),
    updatedAt: toTimestamp(value.updatedAt),
    history: sanitizeHistory(value.history),
  };
}

function sanitizeCollections(value: unknown): AssetCollection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const collections: AssetCollection[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const id = typeof item.id === 'string' ? item.id : '';
    const name = toText(item.name, ASSET_COLLECTION_NAME_MAX);
    if (!ASSET_ID_PATTERN.test(id) || !name || seen.has(id)) continue;
    seen.add(id);
    collections.push({
      id,
      name,
      // 없는 자산을 가리키는 id 는 문서 단위 정리가 걷어낸다
      // (sanitizeAssetLibraryDocument).
      assetIds: sanitizeIdList(item.assetIds, 5000),
    });
    if (collections.length >= ASSET_COLLECTIONS_MAX) break;
  }
  return collections;
}

export function createEmptyAssetLibraryDocument(): AssetLibraryDocument {
  return {
    schemaVersion: ASSET_LIBRARY_SCHEMA_VERSION,
    assets: [],
    collections: [],
  };
}

/**
 * 문서를 읽을 수 있는 모양인지 확인한다. 못 읽는 문서를 빈 문서로 받아들이면
 * 다음 자동 저장이 그 위에 덮어써 내용이 영영 사라진다 — 읽기 실패로 알려
 * 저장을 막는다.
 */
export function assertReadableAssetLibraryDocument(value: unknown): void {
  if (!isObject(value)) {
    throw new Error('Asset library document is not an object.');
  }
  if ('assets' in value && !Array.isArray(value.assets)) {
    throw new Error('Asset library document has a malformed "assets" field.');
  }
  if (
    isFiniteNumber(value.schemaVersion) &&
    value.schemaVersion > ASSET_LIBRARY_SCHEMA_VERSION
  ) {
    throw new Error(
      `Asset library document is newer than this app (schema ${value.schemaVersion}).`,
    );
  }
}

/**
 * 방어를 통과하지 못한 자산 레코드를 원본 그대로 골라낸다. 저장소가 이것을
 * 들고 있다가 저장할 때 문서 끝에 도로 붙인다 — 이 앱이 읽지 못한 레코드
 * (손으로 고치다 어긋난 것, 다른 브랜치의 필드)를 조용히 지우지 않는다.
 */
export function collectUnreadableAssetRecords(value: unknown): unknown[] {
  if (!isObject(value) || !Array.isArray(value.assets)) return [];
  const seen = new Set<string>();
  const unreadable: unknown[] = [];
  for (const item of value.assets) {
    const record = sanitizeAssetRecord(item);
    if (!record || seen.has(record.id)) unreadable.push(item);
    else seen.add(record.id);
  }
  return unreadable;
}

export function sanitizeAssetLibraryDocument(
  value: unknown,
): AssetLibraryDocument {
  if (!isObject(value)) return createEmptyAssetLibraryDocument();
  const seen = new Set<string>();
  const assets: AssetRecord[] = [];
  for (const item of Array.isArray(value.assets) ? value.assets : []) {
    const record = sanitizeAssetRecord(item);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    assets.push(record);
  }
  // 없어진 자산을 가리키는 연결·컬렉션 항목을 걷어낸다 — 문서가 자산의 유일한
  // 원천이라 문서에 없는 id 는 어디에도 없다. 달라진 것이 없으면 레코드
  // 참조를 그대로 둔다.
  const prune = (ids: string[]) => ids.filter((id) => seen.has(id));
  return {
    schemaVersion: ASSET_LIBRARY_SCHEMA_VERSION,
    assets: assets.map((asset) => {
      const related = prune(asset.relatedAssetIds);
      return related.length === asset.relatedAssetIds.length
        ? asset
        : { ...asset, relatedAssetIds: related };
    }),
    collections: sanitizeCollections(value.collections).map((collection) => ({
      ...collection,
      assetIds: prune(collection.assetIds),
    })),
  };
}

export function sanitizeAssetStatsTable(value: unknown): AssetStatsTable {
  if (!isObject(value)) return {};
  const table: AssetStatsTable = {};
  for (const [path, entry] of Object.entries(value)) {
    if (!path.startsWith('/') || !isObject(entry)) continue;
    if (typeof entry.hash !== 'string' || !isFiniteNumber(entry.bytes)) {
      continue;
    }
    const stats = sanitizeAssetStats(entry.stats);
    table[path] = {
      hash: entry.hash,
      bytes: Math.max(0, Math.floor(entry.bytes)),
      ...(stats ? { stats } : {}),
    };
  }
  return table;
}
