import {
  SCENE_MODEL_CATEGORIES,
  type SceneModelCatalogItem,
  type SceneModelCategory,
} from '@crane/domain/3d';
import {
  getCurrentAssetVersion,
  type AssetRecord,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';

/**
 * 3D 화면 편집의 모델 팔레트를 자산 라이브러리에서 만든다.
 *
 * 카탈로그는 "어떤 파일이 있는가" 를 알고, 라이브러리는 "그 자산이 지금
 * 무엇이라 불리고 어떤 상태인가" 를 안다. 팔레트는 둘을 합쳐, 라이브러리가
 * 말하는 이름·분류·썸네일로 보이고 **게시된 자산만** 놓게 한다.
 * 이 화면에서 등록한 모델도 게시하면 팔레트에 나온다.
 *
 * 씬은 자산을 파일 경로로 참조한다 — 팔레트는 놓는 순간의 파일(카탈로그
 * 자산은 카탈로그 경로, 등록한 자산은 현재 버전의 파일)을 씬에 적는다.
 * 이미 놓인 것은 놓을 때의 파일 그대로다.
 */

/** 놓을 수 없는 이유. */
export type ScenePaletteBlockReason =
  /** 현재 버전이 게시 상태가 아니다. */
  | 'unpublished'
  /** 파일이 이 브라우저에만 있어 씬이 가리킬 경로가 없다. */
  | 'local-file';

export interface ScenePaletteModel {
  /** 놓을 때 쓰는 값(이름·경로·기본 스케일). 막힌 자산은 놓지 않는다. */
  item: SceneModelCatalogItem;
  /** 코드 카탈로그의 항목인가(아니면 이 화면에서 등록한 자산). */
  fromCatalog: boolean;
  /** 팔레트의 묶음 — 라이브러리의 분류. 비어 있으면 빈 문자열. */
  group: string;
  /** 라이브러리 자산 id. 라이브러리에 없는 카탈로그 항목은 null. */
  assetId: string | null;
  /** 현재 버전의 상태. 라이브러리를 읽지 못했으면 null. */
  status: AssetVersionStatus | null;
  blocked: ScenePaletteBlockReason | null;
  /** 라이브러리에 저장된 썸네일(배포 경로). 없으면 팔레트의 기본 썸네일. */
  thumbnail: { path: string; stamp: string } | null;
}

function toThumbnail(asset: AssetRecord): ScenePaletteModel['thumbnail'] {
  const thumbnail = asset.thumbnail;
  if (!thumbnail || thumbnail.ref.storage !== 'public') return null;
  return { path: thumbnail.ref.path, stamp: thumbnail.updatedAt };
}

/**
 * 등록한 자산의 카탈로그 분류. 씬에 놓을 때는 쓰이지 않는 값이다(팔레트의
 * 묶음은 `group` 이 맡는다) — 타입이 요구하는 자리를 가장 가까운 값으로 채운다.
 */
function toCatalogCategory(category: string): SceneModelCategory {
  return (SCENE_MODEL_CATEGORIES as readonly string[]).includes(category) &&
    category !== 'map'
    ? (category as SceneModelCategory)
    : 'outdoor';
}

function blockReason(status: AssetVersionStatus): ScenePaletteBlockReason | null {
  return status === 'published' ? null : 'unpublished';
}

/**
 * 팔레트 항목을 만든다. `assets` 가 null 이면 라이브러리를 아직(또는 끝내)
 * 읽지 못한 것이다 — 카탈로그를 그대로 보이고 전부 놓을 수 있게 둔다.
 * 라이브러리가 고장 나도 편집은 멈추지 않는다.
 */
export function buildScenePaletteModels(
  catalog: readonly SceneModelCatalogItem[],
  assets: readonly AssetRecord[] | null,
): ScenePaletteModel[] {
  if (assets === null) {
    return catalog.map((item) => ({
      item,
      fromCatalog: true,
      group: item.category,
      assetId: null,
      status: null,
      blocked: null,
      thumbnail: null,
    }));
  }

  const builtin = new Map(
    assets
      .filter((asset) => asset.origin === 'builtin')
      .map((asset) => [asset.id, asset]),
  );
  const models: ScenePaletteModel[] = catalog.map((item) => {
    const asset = builtin.get(item.id);
    if (!asset) {
      return {
        item,
        fromCatalog: true,
        group: item.category,
        assetId: null,
        status: null,
        blocked: null,
        thumbnail: null,
      };
    }
    const status = getCurrentAssetVersion(asset).status;
    return {
      // 파일과 기본 스케일은 카탈로그 그대로다 — 카탈로그 자산의 정체성
      // (경로·스케일)은 카탈로그가 원천이고, 씬과 다른 화면이 그 값을 쓴다.
      item: { ...item, label: asset.name || item.label },
      fromCatalog: true,
      group: asset.category,
      assetId: asset.id,
      status,
      blocked: blockReason(status),
      thumbnail: toThumbnail(asset),
    };
  });

  const registered = assets
    .filter((asset) => asset.origin === 'user' && asset.kind === 'model')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const asset of registered) {
    const current = getCurrentAssetVersion(asset);
    const ref = current.file.ref;
    models.push({
      item: {
        id: asset.id,
        label: asset.name,
        category: toCatalogCategory(asset.category),
        path: ref.storage === 'public' ? ref.path : '',
        defaultScale: asset.defaultScale,
      },
      fromCatalog: false,
      group: asset.category,
      assetId: asset.id,
      status: current.status,
      blocked:
        ref.storage === 'public' ? blockReason(current.status) : 'local-file',
      thumbnail: toThumbnail(asset),
    });
  }
  return models;
}

function sameCatalogItem(
  a: SceneModelCatalogItem,
  b: SceneModelCatalogItem,
): boolean {
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.path === b.path &&
    a.category === b.category &&
    a.floating === b.floating &&
    a.preview === b.preview &&
    a.defaultScale.length === b.defaultScale.length &&
    a.defaultScale.every((value, index) => value === b.defaultScale[index])
  );
}

/**
 * 놓을 수 있는 항목만 — 캔버스가 미리 받아 두고 드롭을 받는 목록이다.
 *
 * 내용이 `previous` 와 같으면 **그 배열을 그대로** 돌려준다. 캔버스는 이
 * 목록이 바뀌면 프리로드한 모델을 비우고 다시 받으므로, 라이브러리를 읽은
 * 뒤 달라진 것이 없는데 참조만 바뀌면 수십 MB 를 헛되이 다시 읽는다.
 */
export function selectPlaceableCatalog(
  models: readonly ScenePaletteModel[],
  previous: SceneModelCatalogItem[],
): SceneModelCatalogItem[] {
  const next = models
    .filter((model) => model.blocked === null)
    .map((model) => model.item);
  if (
    next.length === previous.length &&
    next.every((item, index) => sameCatalogItem(item, previous[index]))
  ) {
    return previous;
  }
  return next;
}

export interface ScenePaletteGroup {
  group: string;
  count: number;
}

/**
 * 팔레트의 묶음 목록. `preferred`(카탈로그의 분류)가 앞에 오고 자산이 없어도
 * 나온다. 라이브러리에서 새로 생긴 분류는 그 뒤에 이름순으로 붙는다.
 * 분류가 빈 자산은 빈 문자열 묶음에 모인다.
 */
export function listScenePaletteGroups(
  models: readonly ScenePaletteModel[],
  preferred: readonly string[],
): ScenePaletteGroup[] {
  const counts = new Map<string, number>(preferred.map((group) => [group, 0]));
  for (const model of models) {
    counts.set(model.group, (counts.get(model.group) ?? 0) + 1);
  }
  const extra = [...counts.keys()]
    .filter((group) => !preferred.includes(group))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return [...preferred, ...extra].map((group) => ({
    group,
    count: counts.get(group) ?? 0,
  }));
}
