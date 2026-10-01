import {
  AssetDetailPage as AssetDetailWidget,
  AssetLibraryPage as AssetLibraryWidget,
} from '@crane/widgets/asset-library';

/**
 * 3D 자산 라이브러리 — 조선소를 가리지 않는 전사 공용 화면이라 region 하위가
 * 아닌 최상위 경로에 둔다. 화면 본체는 @crane/widgets/asset-library 에 있고
 * 여기서는 놓이는 경로만 알려 준다(shell 의 라우트 등록과 같은 값).
 */
const ASSET_LIBRARY_BASE_PATH = '/asset-library';

export function AssetLibraryPage() {
  return <AssetLibraryWidget basePath={ASSET_LIBRARY_BASE_PATH} />;
}

export function AssetLibraryDetailPage() {
  return <AssetDetailWidget basePath={ASSET_LIBRARY_BASE_PATH} />;
}
