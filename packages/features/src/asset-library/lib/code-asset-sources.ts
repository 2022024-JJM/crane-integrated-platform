import { CODE_ASSETS } from '@crane/domain/3d';
import {
  CODE_USED_DRAWINGS,
  type AssetUsageSource,
} from '@crane/domain/asset-library';

/**
 * 화면 코드가 직접 쓰는 자산을 사용처로 — 씬에 놓이지 않아도 쓰이는 자산이다.
 * 3D 모델(@crane/domain/3d 의 `CODE_ASSETS`)과 도면(`CODE_USED_DRAWINGS`)을
 * 쓰는 곳(`usedBy`)별로 묶는다. 사용처 탭에 "코드에서 사용" 으로 나오고,
 * 쓰이는 버전의 철회와 자산 삭제를 막는다.
 */
export function collectCodeAssetSources(): AssetUsageSource[] {
  const byUser = new Map<string, AssetUsageSource>();
  for (const item of [...Object.values(CODE_ASSETS), ...CODE_USED_DRAWINGS]) {
    const source = byUser.get(item.usedBy) ?? {
      kind: 'code' as const,
      name: item.usedBy,
      regionIds: [],
      editorPath: '',
      refs: [],
    };
    byUser.set(item.usedBy, {
      ...source,
      refs: [
        ...source.refs,
        { path: item.path, asset: { id: item.id, version: item.version } },
      ],
    });
  }
  return [...byUser.values()];
}
