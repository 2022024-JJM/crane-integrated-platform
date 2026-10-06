import type {
  ScenePlaceableAsset,
  ScenePlaceableMap,
  ScenePlaceableModel,
} from '@crane/domain/3d';
import {
  buildAssetCategoryNodes,
  getCurrentAssetVersion,
  hasAllAssetCategories,
  type AssetKind,
  type AssetRecord,
  type AssetTreeCategoryNode,
  type AssetVersionStatus,
} from '@crane/domain/asset-library';

/**
 * 3D 화면 편집의 팔레트(모델·맵·배경 탭)를 자산 라이브러리에서 만든다.
 *
 * 라이브러리가 유일한 원천이다 — 그 종류의 자산이 전부 팔레트에 나오고(배치
 * 속성으로 숨긴 것 제외), **현재 버전이 게시 상태인 것만** 놓을 수 있다.
 * 나머지는 흐리게 보이고 상태가 적힌다(왜 없는지 찾게 두지 않는다).
 *
 * 씬은 놓는 순간의 버전을 적는다(자산 id · 버전 · 파일 경로). 라이브러리에서
 * 현재 버전을 바꿔도 이미 놓인 것은 따라오지 않는다 — 에디터가 새 버전을
 * 알리고 사용자가 갱신한다(scene-asset-updates.ts).
 *
 * 모델 탭은 라이브러리의 카테고리로 좁힌다. 규칙은 라이브러리 화면의 카테고리
 * 체크박스와 같다 — 여러 개를 고르면 모두 가진 모델만 남는다.
 */

/** 놓을 수 없는 이유. */
export type ScenePaletteBlockReason =
  /** 현재 버전이 게시 상태가 아니다. */
  | 'unpublished'
  /** 파일이 이 브라우저에만 있어 씬이 가리킬 경로가 없다. */
  | 'local-file';

export interface ScenePaletteEntry<
  T extends ScenePlaceableAsset = ScenePlaceableAsset,
> {
  /** 놓을 때 쓰는 값(자산 id·버전·이름·경로). 막힌 자산은 놓지 않는다. */
  item: T;
  /** 현재 버전의 상태. */
  status: AssetVersionStatus;
  blocked: ScenePaletteBlockReason | null;
  /** 라이브러리에 저장된 썸네일(배포 경로). 없으면 팔레트의 기본 그림. */
  thumbnail: { path: string; stamp: string } | null;
}

export interface ScenePaletteModel
  extends ScenePaletteEntry<ScenePlaceableModel> {
  /** 자산의 카테고리 — 모델 탭의 카테고리 필터가 이것으로 좁힌다. */
  categories: readonly string[];
}
export type ScenePaletteMap = ScenePaletteEntry<ScenePlaceableMap>;
export type ScenePaletteEnvironment = ScenePaletteEntry;

function toEntry(asset: AssetRecord): ScenePaletteEntry {
  const current = getCurrentAssetVersion(asset);
  const ref = current.file.ref;
  const thumbnail = asset.thumbnail;
  return {
    item: {
      id: asset.id,
      version: current.version,
      label: asset.name,
      path: ref.storage === 'public' ? ref.path : '',
    },
    status: current.status,
    blocked:
      ref.storage !== 'public'
        ? 'local-file'
        : current.status === 'published'
          ? null
          : 'unpublished',
    thumbnail:
      thumbnail && thumbnail.ref.storage === 'public'
        ? { path: thumbnail.ref.path, stamp: thumbnail.updatedAt }
        : null,
  };
}

/** 그 종류의 자산 가운데 팔레트에 내는 것 — 문서 순서 그대로. */
function listPaletteAssets(
  assets: readonly AssetRecord[],
  kind: AssetKind,
): AssetRecord[] {
  return assets.filter(
    (asset) => asset.kind === kind && asset.placement?.paletteHidden !== true,
  );
}

export function buildScenePaletteModels(
  assets: readonly AssetRecord[],
): ScenePaletteModel[] {
  return listPaletteAssets(assets, 'model').map((asset) => ({
    ...toEntry(asset),
    categories: asset.categories,
  }));
}

export function buildScenePaletteMaps(
  assets: readonly AssetRecord[],
): ScenePaletteMap[] {
  return listPaletteAssets(assets, 'map').map((asset) => {
    const entry = toEntry(asset);
    const position = asset.placement?.defaultPosition;
    return {
      ...entry,
      item: {
        ...entry.item,
        role: asset.placement?.mapRole ?? 'ground',
        ...(position ? { defaultPosition: position } : {}),
      },
    };
  });
}

export function buildScenePaletteEnvironments(
  assets: readonly AssetRecord[],
): ScenePaletteEnvironment[] {
  return listPaletteAssets(assets, 'environment').map(toEntry);
}

function samePlaceableModel(
  a: ScenePlaceableModel,
  b: ScenePlaceableModel,
): boolean {
  return (
    a.id === b.id &&
    a.version === b.version &&
    a.label === b.label &&
    a.path === b.path
  );
}

/**
 * 놓을 수 있는 모델만 — 캔버스가 미리 받아 두고 드롭을 받는 목록이다.
 *
 * 내용이 `previous` 와 같으면 **그 배열을 그대로** 돌려준다. 캔버스는 이
 * 목록이 바뀌면 프리로드한 모델을 비우고 다시 받으므로, 라이브러리에서 다른
 * 것(이름 없는 도면의 카테고리 등)이 바뀌어 참조만 달라졌을 때 수십 MB 를 헛되이
 * 다시 읽지 않게 한다.
 */
export function selectPlaceableModels(
  models: readonly ScenePaletteModel[],
  previous: ScenePlaceableModel[],
): ScenePlaceableModel[] {
  const next = models
    .filter((model) => model.blocked === null)
    .map((model) => model.item);
  if (
    next.length === previous.length &&
    next.every((item, index) => samePlaceableModel(item, previous[index]))
  ) {
    return previous;
  }
  return next;
}

/** 모델 탭의 카테고리 한 줄 — 라이브러리 계층의 카테고리 줄과 같은 모양이다. */
export type ScenePaletteCategory = AssetTreeCategoryNode;

/**
 * 모델 탭에서 고를 수 있는 카테고리. 많이 쓰인 순이고, 수는 "지금 고른 것에 이
 * 카테고리까지 걸면 남는 모델 수" 다 — 0 이면 더 고를 수 없다.
 */
export function listScenePaletteCategories(
  models: readonly ScenePaletteModel[],
  selected: readonly string[] = [],
): ScenePaletteCategory[] {
  return buildAssetCategoryNodes(
    models.map((model) => model.categories),
    selected,
  );
}

/**
 * 고른 카테고리를 모두 가진 모델만. 고른 것이 없으면 **받은 배열을 그대로**
 * 돌려준다(전체).
 */
export function filterScenePaletteModels(
  models: ScenePaletteModel[],
  selected: readonly string[],
): ScenePaletteModel[] {
  if (selected.length === 0) return models;
  return models.filter((model) => hasAllAssetCategories(model.categories, selected));
}

/** 카테고리를 고르거나 푼다(대소문자 무시). 새로 고른 카테고리는 뒤에 붙는다. */
export function toggleScenePaletteCategory(
  selected: readonly string[],
  category: string,
): string[] {
  const key = category.toLowerCase();
  const kept = selected.filter((item) => item.toLowerCase() !== key);
  return kept.length === selected.length ? [...selected, category] : kept;
}

/**
 * 고른 카테고리 가운데 지금 팔레트의 모델이 가진 것만 남긴다. 라이브러리에서
 * 카테고리가 없어지면(이름을 고쳤거나 그 자산을 숨겼을 때) 그 조건이 화면에
 * 보이지 않는 채로 목록을 비우지 않게 한다. 빠진 것이 없으면 받은 배열 그대로다.
 */
export function pruneScenePaletteCategories(
  models: readonly ScenePaletteModel[],
  selected: string[],
): string[] {
  if (selected.length === 0) return selected;
  const known = new Set<string>();
  for (const model of models) {
    for (const category of model.categories) known.add(category.toLowerCase());
  }
  const kept = selected.filter((category) => known.has(category.toLowerCase()));
  return kept.length === selected.length ? selected : kept;
}

/**
 * 카테고리 고르기 팝업의 검색 — 이름에 검색어가 든 줄만(대소문자·앞뒤 공백 무시).
 * 검색어가 비면 받은 배열 그대로다.
 */
export function searchScenePaletteCategories(
  categories: ScenePaletteCategory[],
  keyword: string,
): ScenePaletteCategory[] {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return categories;
  return categories.filter((node) => node.category.toLowerCase().includes(needle));
}
