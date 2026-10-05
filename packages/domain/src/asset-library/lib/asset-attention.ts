import {
  isGeometryAssetKind,
  type AssetRecord,
  type AssetStatsTable,
} from '../model/types';
import { evaluateAssetBudget } from './asset-format';
import { resolveVersionStats } from './asset-library-query';
import { getCurrentAssetVersion } from './asset-versions';

/**
 * 관리자가 처리할 일 — 자산마다 "손이 가야 하는 이유" 를 판정한다.
 *
 * 목록은 대부분 문제없는 자산이다. 관리자가 매번 전부를 훑지 않도록, 손이
 * 가야 하는 것만 골라 보는 보기(레일의 "처리할 일")와 카드의 표식이 이
 * 판정을 쓴다. 순서는 급한 순이다.
 */
export const ASSET_ATTENTION_KINDS = [
  /** 검토를 기다리는 버전이 있다. */
  'review',
  /** 반려된 버전이 있다(고쳐서 다시 검토를 요청해야 한다). */
  'rejected',
  /** 아직 검토를 요청하지 않은 초안 버전이 있다. */
  'draft',
  /**
   * 현재 버전보다 새 버전이 검토를 통과했는데(승인·게시) 아직 현재로 지정되지
   * 않았다. 검토 전·검토 중인 새 버전은 그 상태의 이유가 따로 알린다.
   */
  'newer',
  /** 현재 버전이 권장 상한을 넘는다. */
  'over-budget',
  /** 어느 씬에도 놓이지 않았고 화면 코드도 쓰지 않는다. */
  'unused',
] as const;
export type AssetAttentionKind = (typeof ASSET_ATTENTION_KINDS)[number];

export interface AssetAttentionContext {
  statsTable: AssetStatsTable;
  /** 자산 id → 쓰인 횟수(씬에 놓인 개수 + 화면 코드가 직접 쓰는 것). */
  placements: ReadonlyMap<string, number>;
  /**
   * 사용처를 읽었는지. 읽기 전에는 "미사용" 을 판정하지 않는다 — 씬을 아직
   * 못 읽은 것을 안 쓰이는 것으로 보이면 멀쩡한 자산이 정리 대상처럼 보인다.
   */
  usageKnown: boolean;
}

/**
 * 씬에 배치하는 것이 정상인 자산. 도면·CAD·배경은 놓인 곳이 없어도 "미사용" 이
 * 아니다. 화면 코드가 직접 불러 쓰는 모델은 그 사용이 `placements` 에 세어져
 * 있어 미사용으로 잡히지 않는다 — 카테고리로 묻지 않는다(카테고리는 사용자가 고친다).
 */
function isPlacedByDesign(asset: AssetRecord): boolean {
  return isGeometryAssetKind(asset.kind);
}

export function getAssetAttention(
  asset: AssetRecord,
  context: AssetAttentionContext,
): AssetAttentionKind[] {
  const reasons: AssetAttentionKind[] = [];
  if (asset.versions.some((version) => version.status === 'in-review')) {
    reasons.push('review');
  }
  if (asset.versions.some((version) => version.status === 'rejected')) {
    reasons.push('rejected');
  }
  if (asset.versions.some((version) => version.status === 'draft')) {
    reasons.push('draft');
  }
  if (
    asset.versions.some(
      (version) =>
        version.version > asset.currentVersion &&
        (version.status === 'approved' || version.status === 'published'),
    )
  ) {
    reasons.push('newer');
  }
  const stats = resolveVersionStats(
    getCurrentAssetVersion(asset),
    context.statsTable,
  );
  if (stats && evaluateAssetBudget(asset.kind, stats).length > 0) {
    reasons.push('over-budget');
  }
  if (
    context.usageKnown &&
    isPlacedByDesign(asset) &&
    (context.placements.get(asset.id) ?? 0) === 0
  ) {
    reasons.push('unused');
  }
  return reasons;
}

export function countAssetAttention(
  assets: readonly AssetRecord[],
  context: AssetAttentionContext,
): Record<AssetAttentionKind, number> {
  const counts = Object.fromEntries(
    ASSET_ATTENTION_KINDS.map((kind) => [kind, 0]),
  ) as Record<AssetAttentionKind, number>;
  for (const asset of assets) {
    for (const reason of getAssetAttention(asset, context)) {
      counts[reason] += 1;
    }
  }
  return counts;
}
