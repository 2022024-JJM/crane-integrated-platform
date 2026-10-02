import {
  sceneEnvironmentCatalog,
  sceneMapCatalog,
  sceneModelCatalog,
} from '@crane/domain/3d';
import {
  builtinDrawingSources,
  builtinRuntimeModelSources,
  type BuiltinAssetSource,
} from '@crane/domain/asset-library';

/**
 * builtin 자산의 원천 — 씬 편집기 카탈로그(모델·지도·배경)와 카탈로그 밖 배포
 * 자산(코드가 직접 로드하는 모델, 설비 배치도)을 한 목록으로 모은다.
 *
 * 카탈로그에 항목을 추가하면 라이브러리에 자동으로 나타난다. 카탈로그 id 가
 * 곧 자산 id 다(모델은 `okpo-ttc`, 지도는 `map-okpo`, 배경은
 * `overcast-atlantic`).
 *
 * 모델·지도는 카탈로그의 분류를 첫 태그로 받는다 — 새로 추가한 항목이 탐색
 * 계층의 체크박스 아래에 바로 놓인다. 저장 문서에 이미 있는 자산은 문서의
 * 태그가 이긴다.
 */
export function collectBuiltinAssetSources(): BuiltinAssetSource[] {
  return [
    ...sceneModelCatalog.map(
      (item): BuiltinAssetSource => ({
        id: item.id,
        kind: 'model',
        name: item.label,
        path: item.path,
        catalogId: item.id,
        defaultScale: item.defaultScale,
        tags: [item.category],
      }),
    ),
    ...sceneMapCatalog.map(
      (item): BuiltinAssetSource => ({
        id: item.id,
        kind: 'map',
        name: item.label,
        path: item.path,
        catalogId: item.id,
        tags: [item.kind],
      }),
    ),
    // 카탈로그 경로는 선행 슬래시가 없어 public 절대 경로로 맞춘다.
    ...sceneEnvironmentCatalog.map(
      (item): BuiltinAssetSource => ({
        id: item.id,
        kind: 'environment',
        name: item.label,
        path: `/${item.path.replace(/^\//, '')}`,
      }),
    ),
    ...builtinRuntimeModelSources,
    ...builtinDrawingSources,
  ];
}
