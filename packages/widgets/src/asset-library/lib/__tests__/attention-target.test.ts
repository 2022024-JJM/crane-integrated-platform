import { describe, expect, it } from 'vitest';
import type { AssetRecord, AssetVersion } from '@crane/domain/asset-library';
import {
  attentionTargetSearch,
  resolveAttentionTarget,
} from '../attention-target';

const version = (
  number: number,
  status: AssetVersion['status'],
): AssetVersion => ({
  version: number,
  status,
  file: {
    ref: { storage: 'public', path: `/models/a-v${number}.glb` },
    fileName: `a-v${number}.glb`,
    format: 'glb',
    sizeBytes: null,
    contentHash: null,
  },
  note: '',
  createdAt: '',
  createdBy: '',
});

const asset = (versions: AssetVersion[], currentVersion = 1): AssetRecord => ({
  id: 'a',
  kind: 'model',
  origin: 'user',
  name: 'A',
  description: '',
  category: '',
  sites: [],
  tags: [],
  owner: '',
  defaultScale: [1, 1, 1],
  relatedAssetIds: [],
  versions,
  currentVersion,
  createdAt: '',
  updatedAt: '',
  history: [],
});

describe('resolveAttentionTarget', () => {
  const record = asset([
    version(1, 'published'),
    version(2, 'rejected'),
    version(3, 'in-review'),
    version(4, 'in-review'),
    version(5, 'draft'),
    version(6, 'withdrawn'),
  ]);

  it('상태에 걸린 일은 그 상태의 가장 최신 버전으로 보낸다', () => {
    expect(resolveAttentionTarget(record, 'review')).toEqual({
      version: 4,
      tab: 'versions',
    });
    expect(resolveAttentionTarget(record, 'rejected').version).toBe(2);
    expect(resolveAttentionTarget(record, 'draft').version).toBe(5);
  });

  it('새 버전은 반려·철회를 뺀 가장 최신', () => {
    expect(resolveAttentionTarget(record, 'newer').version).toBe(5);
  });

  it('상한 초과는 통계, 미사용은 사용처 — 버전은 그대로', () => {
    expect(resolveAttentionTarget(record, 'over-budget')).toEqual({
      version: null,
      tab: 'stats',
    });
    expect(resolveAttentionTarget(record, 'unused')).toEqual({
      version: null,
      tab: 'usage',
    });
  });

  it('해당 버전이 없으면 버전을 정하지 않는다', () => {
    const plain = asset([version(1, 'published')]);
    expect(resolveAttentionTarget(plain, 'review').version).toBeNull();
    expect(resolveAttentionTarget(plain, 'newer').version).toBeNull();
  });
});

describe('attentionTargetSearch', () => {
  const record = asset([version(1, 'published'), version(2, 'in-review')]);

  it('탭과 버전을 쓴다', () => {
    expect(
      attentionTargetSearch(record, { version: 2, tab: 'versions' }),
    ).toBe('?tab=versions&v=2');
  });

  it('현재 버전·기본 탭은 쓰지 않는다', () => {
    expect(attentionTargetSearch(record, { version: 1, tab: 'stats' })).toBe(
      '?tab=stats',
    );
    expect(attentionTargetSearch(record, { version: null, tab: 'info' })).toBe(
      '',
    );
  });
});
