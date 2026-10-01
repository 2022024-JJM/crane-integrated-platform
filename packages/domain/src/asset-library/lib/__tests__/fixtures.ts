import type {
  AssetLibraryDocument,
  AssetRecord,
  AssetVersion,
} from '../../model/types';
import type { AssetChangeContext } from '../asset-versions';

export function version(overrides: Partial<AssetVersion> = {}): AssetVersion {
  return {
    version: 1,
    status: 'published',
    file: {
      ref: { storage: 'public', path: '/models/a.glb' },
      fileName: 'a.glb',
      format: 'glb',
      sizeBytes: null,
      contentHash: null,
    },
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'tester',
    ...overrides,
  };
}

export function asset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: 'asset-a',
    kind: 'model',
    origin: 'user',
    name: 'Asset A',
    description: '',
    category: 'outdoor',
    sites: [],
    tags: [],
    owner: '',
    defaultScale: [1, 1, 1],
    relatedAssetIds: [],
    versions: [version()],
    currentVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    history: [],
    ...overrides,
  };
}

export function document(
  assets: AssetRecord[] = [],
): AssetLibraryDocument {
  return { schemaVersion: 1, assets, collections: [] };
}

let counter = 0;
/** 시각을 고정한 변경 컨텍스트 — 이력 id 만 호출마다 달라진다. */
export function ctx(
  at = '2026-02-01T00:00:00.000Z',
  actor = 'tester',
): AssetChangeContext {
  counter += 1;
  return { entryId: `entry-${counter}`, at, actor };
}
