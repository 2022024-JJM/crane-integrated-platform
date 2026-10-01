import type {
  AssetAttentionKind,
  AssetRecord,
  AssetVersionStatus,
} from '@crane/domain/asset-library';
import type { DetailTab } from './asset-library-url';

/**
 * "처리할 일" 을 누르면 가야 하는 곳 — 그 일을 처리할 버전과 탭. 안내만 하고
 * 어디서 처리하는지는 찾게 두지 않는다.
 */
export interface AttentionTarget {
  /** 봐야 하는 버전. null 이면 현재 버전 그대로. */
  version: number | null;
  tab: DetailTab;
}

/** 그 상태인 버전 중 가장 최신. */
function latestWithStatus(
  asset: AssetRecord,
  status: AssetVersionStatus,
): number | null {
  const versions = asset.versions
    .filter((version) => version.status === status)
    .map((version) => version.version);
  return versions.length > 0 ? Math.max(...versions) : null;
}

export function resolveAttentionTarget(
  asset: AssetRecord,
  kind: AssetAttentionKind,
): AttentionTarget {
  switch (kind) {
    case 'review':
      return { version: latestWithStatus(asset, 'in-review'), tab: 'versions' };
    case 'rejected':
      return { version: latestWithStatus(asset, 'rejected'), tab: 'versions' };
    case 'draft':
      return { version: latestWithStatus(asset, 'draft'), tab: 'versions' };
    case 'newer': {
      const newer = asset.versions
        .filter(
          (version) =>
            version.version > asset.currentVersion &&
            (version.status === 'approved' || version.status === 'published'),
        )
        .map((version) => version.version);
      return {
        version: newer.length > 0 ? Math.max(...newer) : null,
        tab: 'versions',
      };
    }
    case 'over-budget':
      return { version: null, tab: 'stats' };
    case 'unused':
      return { version: null, tab: 'usage' };
  }
}

/**
 * 미리보기가 보여 줄 버전 — 지금 손이 가야 하는 버전이다. 검토 대기 목록에서
 * 자산을 열었는데 이미 게시된 현재 버전이 보이면, 검토할 것을 보려고 상세까지
 * 가야 한다.
 *
 * `filter` 는 목록에 걸린 "처리할 일" 필터다. 그 일의 대상 버전이 먼저이고,
 * 필터가 없으면 검토 중인 버전, 그것도 없으면 현재 버전이다.
 */
export function pickPreviewVersion(
  asset: AssetRecord,
  filter: AssetAttentionKind | null,
): number {
  if (filter !== null) {
    const target = resolveAttentionTarget(asset, filter).version;
    if (target !== null) return target;
  }
  return latestWithStatus(asset, 'in-review') ?? asset.currentVersion;
}

/** 상세 화면 경로에 붙일 쿼리스트링(`?` 포함, 없으면 빈 문자열). */
export function attentionTargetSearch(
  asset: AssetRecord,
  target: AttentionTarget,
): string {
  const params = new URLSearchParams();
  if (target.tab !== 'info') params.set('tab', target.tab);
  if (target.version !== null && target.version !== asset.currentVersion) {
    params.set('v', String(target.version));
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}
