import { sceneMapCatalog, sceneModelCatalog } from '@crane/domain/3d';
import {
  builtinDrawingSources,
  builtinRuntimeModelSources,
  type BuiltinAssetSource,
} from '@crane/domain/asset-library';

/**
 * builtin 자산의 원천 — 씬 편집기 카탈로그(모델·지도)와 카탈로그 밖 배포
 * 자산(코드가 직접 로드하는 모델, 설비 배치도)을 한 목록으로 모은다.
 *
 * 카탈로그에 항목을 추가하면 라이브러리에 자동으로 나타난다. 카탈로그 id 가
 * 곧 자산 id 다(모델은 `okpo-ttc`, 지도는 `map-okpo`).
 */
export function collectBuiltinAssetSources(): BuiltinAssetSource[] {
  return [
    ...sceneModelCatalog.map(
      (item): BuiltinAssetSource => ({
        id: item.id,
        kind: 'model',
        name: item.label,
        path: item.path,
        category: item.category,
        catalogId: item.id,
        defaultScale: item.defaultScale,
      }),
    ),
    ...sceneMapCatalog.map(
      (item): BuiltinAssetSource => ({
        id: item.id,
        kind: 'map',
        name: item.label,
        path: item.path,
        category: item.kind,
        catalogId: item.id,
      }),
    ),
    ...builtinRuntimeModelSources,
    ...builtinDrawingSources,
  ];
}
