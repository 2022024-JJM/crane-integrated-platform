import { describe, expect, it } from 'vitest';
import type { AssetRecord, AssetVersion } from '@crane/domain/asset-library';
import {
  attentionTargetSearch,
  pickPreviewVersion,
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
  name: 'A',
  description: '',
  categories: [],
  owner: '',
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

  it('새 버전은 검토를 통과한(승인·게시) 것 중 가장 최신', () => {
    // record 의 새 버전은 반려·검토 중·초안·철회뿐이라 해당이 없다.
    expect(resolveAttentionTarget(record, 'newer').version).toBeNull();
    const ready = asset([
      version(1, 'published'),
      version(2, 'approved'),
      version(3, 'published'),
      version(4, 'draft'),
    ]);
    expect(resolveAttentionTarget(ready, 'newer').version).toBe(3);
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

describe('pickPreviewVersion', () => {
  const record = asset([
    version(1, 'published'),
    version(2, 'rejected'),
    version(3, 'in-review'),
    version(4, 'draft'),
  ]);

  it('걸린 필터의 대상 버전이 먼저다', () => {
    expect(pickPreviewVersion(record, 'review')).toBe(3);
    expect(pickPreviewVersion(record, 'rejected')).toBe(2);
    expect(pickPreviewVersion(record, 'draft')).toBe(4);
  });

  it('필터가 없으면 검토 중인 버전, 그것도 없으면 현재 버전', () => {
    expect(pickPreviewVersion(record, null)).toBe(3);
    expect(pickPreviewVersion(asset([version(1, 'published')]), null)).toBe(1);
  });

  it('필터의 대상 버전이 없으면(상한 초과·미사용 등) 같은 규칙으로 내려간다', () => {
    expect(pickPreviewVersion(record, 'over-budget')).toBe(3);
    expect(
      pickPreviewVersion(asset([version(1, 'published')]), 'review'),
    ).toBe(1);
  });
});
