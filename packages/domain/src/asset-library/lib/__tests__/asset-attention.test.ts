import { describe, expect, it } from 'vitest';
import { ASSET_BUDGET } from '../asset-format';
import {
  ASSET_ATTENTION_KINDS,
  countAssetAttention,
  getAssetAttention,
  type AssetAttentionContext,
} from '../asset-attention';
import { DEFAULT_ASSET_QUERY, queryAssets } from '../asset-library-query';
import { asset, version } from './fixtures';

const stats = (triangles: number) => ({
  triangles,
  vertices: 0,
  meshes: 0,
  materials: 0,
  textures: 0,
  drawCalls: 0,
  nodes: 0,
  textureMemoryBytes: 0,
  size: null,
  lodLevels: 1,
  animations: 0,
});

function ctx(patch: Partial<AssetAttentionContext> = {}): AssetAttentionContext {
  return { statsTable: {}, placements: new Map(), usageKnown: true, ...patch };
}

/** 놓여 있고 게시된, 손 갈 데 없는 자산. */
const healthy = asset({ id: 'healthy' });
const placed = ctx({ placements: new Map([['healthy', 2]]) });

describe('getAssetAttention', () => {
  it('문제없는 자산은 빈 목록', () => {
    expect(getAssetAttention(healthy, placed)).toEqual([]);
  });

  it('버전 상태에서 검토 대기·반려·초안을 찾는다(현재 버전이 아니어도)', () => {
    const record = asset({
      id: 'healthy',
      versions: [
        version({ version: 1, status: 'published' }),
        version({ version: 2, status: 'rejected' }),
        version({ version: 3, status: 'in-review' }),
        version({ version: 4, status: 'draft' }),
      ],
      currentVersion: 1,
    });
    // 새 버전이 전부 검토 전·검토 중·반려라 "새 버전 있음" 은 아니다.
    expect(getAssetAttention(record, placed)).toEqual([
      'review',
      'rejected',
      'draft',
    ]);
  });

  it('검토를 통과한 새 버전(승인·게시)만 "새 버전" 이다', () => {
    const ready = (status: 'approved' | 'published' | 'draft' | 'in-review') =>
      getAssetAttention(
        asset({
          id: 'healthy',
          versions: [version({ version: 1 }), version({ version: 2, status })],
          currentVersion: 1,
        }),
        placed,
      ).includes('newer');
    expect(ready('approved')).toBe(true);
    expect(ready('published')).toBe(true);
    expect(ready('draft')).toBe(false);
    expect(ready('in-review')).toBe(false);
  });

  it('현재보다 새 버전이 반려·철회뿐이면 "새 버전" 이 아니다', () => {
    const record = asset({
      id: 'healthy',
      versions: [
        version({ version: 1 }),
        version({ version: 2, status: 'withdrawn' }),
      ],
      currentVersion: 1,
    });
    expect(getAssetAttention(record, placed)).not.toContain('newer');
    // 현재 버전 자신이나 옛 버전은 "새 버전" 이 아니다.
    const rolledBack = asset({
      id: 'healthy',
      versions: [version({ version: 1 }), version({ version: 2 })],
      currentVersion: 2,
    });
    expect(getAssetAttention(rolledBack, placed)).toEqual([]);
  });

  it('권장 상한은 정확값까지 통과, +1 부터 표시', () => {
    const at = (triangles: number) =>
      asset({ id: 'healthy', versions: [version({ stats: stats(triangles) })] });
    expect(getAssetAttention(at(ASSET_BUDGET.triangles), placed)).toEqual([]);
    expect(getAssetAttention(at(ASSET_BUDGET.triangles + 1), placed)).toEqual([
      'over-budget',
    ]);
  });

  it('통계를 모르면 상한 초과를 판정하지 않는다', () => {
    expect(getAssetAttention(healthy, placed)).not.toContain('over-budget');
  });

  it('사용처를 읽기 전에는 미사용을 판정하지 않는다', () => {
    const unknown = ctx({ usageKnown: false });
    expect(getAssetAttention(healthy, unknown)).toEqual([]);
    expect(getAssetAttention(healthy, ctx())).toEqual(['unused']);
  });

  it('도면·CAD 와 런타임 자산은 놓인 곳이 없어도 미사용이 아니다', () => {
    expect(getAssetAttention(asset({ kind: 'drawing' }), ctx())).toEqual([]);
    expect(getAssetAttention(asset({ kind: 'cad' }), ctx())).toEqual([]);
    expect(getAssetAttention(asset({ category: 'runtime' }), ctx())).toEqual([]);
  });
});

describe('countAssetAttention', () => {
  it('모든 이유를 0 부터 세고, 한 자산이 여러 이유에 들어갈 수 있다', () => {
    const draft = asset({
      id: 'draft',
      versions: [version({ status: 'draft' })],
    });
    const counts = countAssetAttention([healthy, draft], placed);
    expect(Object.keys(counts)).toEqual([...ASSET_ATTENTION_KINDS]);
    expect(counts).toMatchObject({ draft: 1, unused: 1, review: 0 });
    expect(countAssetAttention([], ctx()).review).toBe(0);
  });
});

describe('queryAssets — 처리할 일 필터', () => {
  const draft = asset({ id: 'draft', versions: [version({ status: 'draft' })] });
  const context = {
    collections: [],
    favorites: new Set<string>(),
    statsTable: {},
    placements: new Map([['healthy', 1]]),
    usageKnown: true,
  };

  it('그 이유에 해당하는 자산만 남긴다', () => {
    const ids = (attention: (typeof ASSET_ATTENTION_KINDS)[number]) =>
      queryAssets([healthy, draft], { ...DEFAULT_ASSET_QUERY, attention }, context).map(
        (a) => a.id,
      );
    expect(ids('draft')).toEqual(['draft']);
    expect(ids('unused')).toEqual(['draft']);
    expect(ids('review')).toEqual([]);
  });

  it('사용처 정보를 주지 않으면 미사용 필터는 아무것도 고르지 않는다', () => {
    expect(
      queryAssets(
        [healthy, draft],
        { ...DEFAULT_ASSET_QUERY, attention: 'unused' },
        { collections: [], favorites: new Set(), statsTable: {} },
      ),
    ).toEqual([]);
  });
});
