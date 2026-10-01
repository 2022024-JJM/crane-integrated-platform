import {
  ASSET_HISTORY_MAX,
  ASSET_VERSIONS_MAX,
  type AssetFile,
  type AssetHistoryEntry,
  type AssetRecord,
  type AssetStats,
  type AssetThumbnail,
  type AssetVersion,
  type AssetVersionStatus,
} from '../model/types';

/**
 * 자산 레코드를 바꾸는 순수 함수들 — 버전 추가, 현재 버전 이동, 상태 전이,
 * 메타데이터 수정. 모두 새 레코드를 돌려주고, 바뀐 것이 없으면 **입력 참조를
 * 그대로** 돌려준다(호출부가 참조 비교로 저장 여부를 정한다).
 *
 * 시각과 행위자는 인자로 받는다 — 시계에 기대지 않아 테스트가 결정론적이다.
 */

export interface AssetChangeContext {
  /** 이력 항목 id. 호출부가 고유 값을 만든다. */
  entryId: string;
  at: string;
  actor: string;
}

/**
 * 상태 전이 표. 새 버전은 draft 로 시작해 검토 → 승인/반려 → 게시로 가고,
 * 게시된 버전은 철회했다가 다시 게시할 수 있다. 표에 없는 전이는 거부한다.
 */
const STATUS_TRANSITIONS: Record<AssetVersionStatus, AssetVersionStatus[]> = {
  draft: ['in-review'],
  'in-review': ['approved', 'rejected'],
  approved: ['published'],
  rejected: ['in-review'],
  published: ['withdrawn'],
  withdrawn: ['published'],
};

export function getAllowedStatusTransitions(
  from: AssetVersionStatus,
): AssetVersionStatus[] {
  return STATUS_TRANSITIONS[from];
}

export function canTransitionStatus(
  from: AssetVersionStatus,
  to: AssetVersionStatus,
): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function getAssetVersion(
  asset: AssetRecord,
  version: number,
): AssetVersion | null {
  return asset.versions.find((v) => v.version === version) ?? null;
}

/** 현재 버전. 포인터가 깨졌으면 마지막 버전으로 떨어진다. */
export function getCurrentAssetVersion(asset: AssetRecord): AssetVersion {
  return (
    getAssetVersion(asset, asset.currentVersion) ??
    asset.versions[asset.versions.length - 1]
  );
}

/**
 * 다음 버전 번호 — 지금까지의 최댓값 + 1. 번호는 재사용하지 않는다: 지운
 * 버전의 번호도 이력에 남아 있으므로 이력까지 본다(같은 번호가 두 번 쓰이면
 * 이력의 "v3" 이 어느 파일인지 알 수 없다).
 */
export function getNextAssetVersionNumber(asset: AssetRecord): number {
  const fromVersions = asset.versions.reduce(
    (max, v) => Math.max(max, v.version),
    0,
  );
  const fromHistory = asset.history.reduce(
    (max, entry) => Math.max(max, entry.version ?? 0),
    0,
  );
  return Math.max(fromVersions, fromHistory) + 1;
}

/**
 * 이 버전을 지울 수 있는가. 잘못 올린 것을 걷어내는 용도라, 게시된 적 없는
 * 버전(초안·반려)만 지운다. 현재 버전과 마지막 남은 버전은 지울 수 없다.
 */
export function canRemoveAssetVersion(
  asset: AssetRecord,
  version: number,
): boolean {
  const target = getAssetVersion(asset, version);
  if (!target || asset.versions.length <= 1) return false;
  if (asset.currentVersion === version) return false;
  return target.status === 'draft' || target.status === 'rejected';
}

/** 버전을 지운다(파일은 호출부가 지운다). 지울 수 없으면 그대로 돌려준다. */
export function removeAssetVersion(
  asset: AssetRecord,
  version: number,
  context: AssetChangeContext,
): AssetRecord {
  if (!canRemoveAssetVersion(asset, version)) return asset;
  return {
    ...asset,
    versions: asset.versions.filter((item) => item.version !== version),
    updatedAt: context.at,
    history: pushHistory(asset.history, {
      id: context.entryId,
      at: context.at,
      actor: context.actor,
      action: 'version-removed',
      version,
    }),
  };
}

function pushHistory(
  history: readonly AssetHistoryEntry[],
  entry: AssetHistoryEntry,
): AssetHistoryEntry[] {
  return [...history, entry].slice(-ASSET_HISTORY_MAX);
}

export interface AddAssetVersionInput {
  file: AssetFile;
  note: string;
  revision?: string;
  stats?: AssetStats;
}

/**
 * 새 버전을 draft 로 붙인다. 현재 버전은 옮기지 않는다 — 검토를 거쳐
 * 사용자가 명시적으로 옮긴다. 상한에 닿았으면 그대로 돌려준다.
 */
export function addAssetVersion(
  asset: AssetRecord,
  input: AddAssetVersionInput,
  context: AssetChangeContext,
): AssetRecord {
  if (asset.versions.length >= ASSET_VERSIONS_MAX) return asset;
  const version = getNextAssetVersionNumber(asset);
  const next: AssetVersion = {
    version,
    status: 'draft',
    file: input.file,
    note: input.note,
    ...(input.revision ? { revision: input.revision } : {}),
    createdAt: context.at,
    createdBy: context.actor,
    ...(input.stats ? { stats: input.stats } : {}),
  };
  return {
    ...asset,
    versions: [...asset.versions, next],
    updatedAt: context.at,
    history: pushHistory(asset.history, {
      id: context.entryId,
      at: context.at,
      actor: context.actor,
      action: 'version-added',
      version,
    }),
  };
}

/**
 * 현재 버전 포인터를 옮긴다. 철회·반려된 버전은 현재가 될 수 없다.
 * 이미 현재이거나 없는 버전이면 그대로 돌려준다.
 */
export function setCurrentAssetVersion(
  asset: AssetRecord,
  version: number,
  context: AssetChangeContext,
): AssetRecord {
  if (asset.currentVersion === version) return asset;
  const target = getAssetVersion(asset, version);
  if (!target) return asset;
  if (target.status === 'withdrawn' || target.status === 'rejected') {
    return asset;
  }
  return {
    ...asset,
    currentVersion: version,
    updatedAt: context.at,
    history: pushHistory(asset.history, {
      id: context.entryId,
      at: context.at,
      actor: context.actor,
      action: 'current-changed',
      version,
      from: String(asset.currentVersion),
      to: String(version),
    }),
  };
}

/** 표가 허용하는 전이만 반영한다. 그 외는 그대로 돌려준다. */
export function transitionAssetVersionStatus(
  asset: AssetRecord,
  version: number,
  to: AssetVersionStatus,
  context: AssetChangeContext,
): AssetRecord {
  const target = getAssetVersion(asset, version);
  if (!target || !canTransitionStatus(target.status, to)) return asset;
  return {
    ...asset,
    versions: asset.versions.map((v) =>
      v.version === version ? { ...v, status: to } : v,
    ),
    updatedAt: context.at,
    history: pushHistory(asset.history, {
      id: context.entryId,
      at: context.at,
      actor: context.actor,
      action: 'status',
      version,
      from: target.status,
      to,
    }),
  };
}

/** 버전 메모·리비전은 버전을 만들지 않고 고친다(파일은 불변). */
export function updateAssetVersionNote(
  asset: AssetRecord,
  version: number,
  patch: { note?: string; revision?: string },
  context: AssetChangeContext,
): AssetRecord {
  const target = getAssetVersion(asset, version);
  if (!target) return asset;
  const note = patch.note ?? target.note;
  const revision = patch.revision ?? target.revision ?? '';
  if (note === target.note && revision === (target.revision ?? '')) {
    return asset;
  }
  const { revision: _previous, ...rest } = target;
  void _previous;
  const next: AssetVersion = {
    ...rest,
    note,
    ...(revision ? { revision } : {}),
  };
  return {
    ...asset,
    versions: asset.versions.map((v) => (v.version === version ? next : v)),
    updatedAt: context.at,
  };
}

/** 측정한 통계를 버전에 채운다. 이력을 남기지 않는 파생 값이다. */
export function setAssetVersionStats(
  asset: AssetRecord,
  version: number,
  stats: AssetStats,
): AssetRecord {
  const target = getAssetVersion(asset, version);
  if (!target) return asset;
  return {
    ...asset,
    versions: asset.versions.map((v) =>
      v.version === version ? { ...v, stats } : v,
    ),
  };
}

export type AssetMetadataPatch = Partial<
  Pick<
    AssetRecord,
    | 'name'
    | 'description'
    | 'category'
    | 'sites'
    | 'tags'
    | 'owner'
    | 'kind'
    | 'drawingNo'
    | 'relatedAssetIds'
    | 'defaultScale'
  >
>;

function isSameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => item === b[i]);
  }
  return (a ?? '') === (b ?? '');
}

/** 같은 사람이 이 시간 안에 이어서 고친 메타데이터는 이력 한 줄로 묶는다. */
export const METADATA_HISTORY_MERGE_MS = 10 * 60 * 1000;

/**
 * 메타데이터를 고친다. 실제로 달라진 필드만 반영하고, 달라진 것이 없으면
 * 그대로 돌려준다. builtin 자산의 종류·기본 스케일은 카탈로그가 정하므로
 * 무시한다.
 */
export function updateAssetMetadata(
  asset: AssetRecord,
  patch: AssetMetadataPatch,
  context: AssetChangeContext,
): AssetRecord {
  const changed: string[] = [];
  const next: AssetRecord = { ...asset };
  for (const key of Object.keys(patch) as (keyof AssetMetadataPatch)[]) {
    if (asset.origin === 'builtin' && (key === 'kind' || key === 'defaultScale')) {
      continue;
    }
    const value = patch[key];
    if (value === undefined || isSameValue(asset[key], value)) continue;
    if (key === 'drawingNo' && value === '') {
      delete next.drawingNo;
    } else {
      (next as unknown as Record<string, unknown>)[key] = value;
    }
    changed.push(key);
  }
  if (changed.length === 0) return asset;

  const last = asset.history[asset.history.length - 1];
  const mergeable =
    last !== undefined &&
    last.action === 'metadata' &&
    last.actor === context.actor &&
    Date.parse(context.at) - Date.parse(last.at) <= METADATA_HISTORY_MERGE_MS &&
    Date.parse(context.at) >= Date.parse(last.at);

  next.updatedAt = context.at;
  next.history = mergeable
    ? [
        ...asset.history.slice(0, -1),
        {
          ...last,
          at: context.at,
          fields: [...new Set([...(last.fields ?? []), ...changed])],
        },
      ]
    : pushHistory(asset.history, {
        id: context.entryId,
        at: context.at,
        actor: context.actor,
        action: 'metadata',
        fields: changed,
      });
  return next;
}

/**
 * 썸네일을 붙인다. `context` 가 null 이면 이력을 남기지 않는다 — 썸네일이 없는
 * 자산을 처음 열었을 때 자동으로 찍는 것은 사람의 작업이 아니라 파생물이다.
 */
export function setAssetThumbnail(
  asset: AssetRecord,
  thumbnail: AssetThumbnail,
  context: AssetChangeContext | null,
): AssetRecord {
  return {
    ...asset,
    thumbnail,
    history: context
      ? pushHistory(asset.history, {
          id: context.entryId,
          at: context.at,
          actor: context.actor,
          action: 'thumbnail',
        })
      : asset.history,
  };
}

export interface CreateUserAssetInput {
  id: string;
  kind: AssetRecord['kind'];
  name: string;
  description: string;
  category: string;
  sites: AssetRecord['sites'];
  tags: string[];
  file: AssetFile;
  note: string;
  revision?: string;
  drawingNo?: string;
  stats?: AssetStats;
}

/** 이 화면에서 등록한 자산 — 버전 1(draft)과 생성 이력으로 시작한다. */
export function createUserAssetRecord(
  input: CreateUserAssetInput,
  context: AssetChangeContext,
): AssetRecord {
  return {
    id: input.id,
    kind: input.kind,
    origin: 'user',
    name: input.name,
    description: input.description,
    category: input.category,
    sites: input.sites,
    tags: input.tags,
    owner: context.actor,
    defaultScale: [1, 1, 1],
    ...(input.drawingNo ? { drawingNo: input.drawingNo } : {}),
    relatedAssetIds: [],
    versions: [
      {
        version: 1,
        status: 'draft',
        file: input.file,
        note: input.note,
        ...(input.revision ? { revision: input.revision } : {}),
        createdAt: context.at,
        createdBy: context.actor,
        ...(input.stats ? { stats: input.stats } : {}),
      },
    ],
    currentVersion: 1,
    createdAt: context.at,
    updatedAt: context.at,
    history: [
      {
        id: context.entryId,
        at: context.at,
        actor: context.actor,
        action: 'created',
        version: 1,
      },
    ],
  };
}

export interface AssetStatsDelta {
  triangles: number;
  vertices: number;
  drawCalls: number;
  textureMemoryBytes: number;
}

/** 두 버전의 통계 차이(다음 − 이전). 어느 한쪽이 없으면 null. */
export function diffAssetStats(
  previous: AssetStats | undefined,
  next: AssetStats | undefined,
): AssetStatsDelta | null {
  if (!previous || !next) return null;
  return {
    triangles: next.triangles - previous.triangles,
    vertices: next.vertices - previous.vertices,
    drawCalls: next.drawCalls - previous.drawCalls,
    textureMemoryBytes: next.textureMemoryBytes - previous.textureMemoryBytes,
  };
}
