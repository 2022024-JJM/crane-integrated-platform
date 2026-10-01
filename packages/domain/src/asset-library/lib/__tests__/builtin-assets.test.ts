import { describe, expect, it } from 'vitest';
import type { BuiltinAssetSource } from '../../model/types';
import { buildBuiltinAssetRecord, mergeAssetLibrary } from '../builtin-assets';
import { asset, document, version } from './fixtures';

const source: BuiltinAssetSource = {
  id: 'okpo-ttc',
  kind: 'model',
  name: 'Okpo TTC',
  path: '/models/okpo_ttc.glb',
  category: 'outdoor',
  catalogId: 'okpo-ttc',
  defaultScale: [1, 1, 1],
};

describe('buildBuiltinAssetRecord', () => {
  it('배포 파일을 버전 1(게시됨)로 가진 builtin 레코드를 만든다', () => {
    const record = buildBuiltinAssetRecord(source);
    expect(record).toMatchObject({
      id: 'okpo-ttc',
      origin: 'builtin',
      catalogId: 'okpo-ttc',
      currentVersion: 1,
      sites: [],
    });
    expect(record.versions).toHaveLength(1);
    expect(record.versions[0]).toMatchObject({
      version: 1,
      status: 'published',
      file: {
        ref: { storage: 'public', path: '/models/okpo_ttc.glb' },
        fileName: 'okpo_ttc.glb',
        format: 'glb',
      },
    });
  });

  it('카탈로그 id 가 없는 원천은 catalogId 필드를 만들지 않는다', () => {
    const { catalogId: _unused, ...rest } = source;
    void _unused;
    expect('catalogId' in buildBuiltinAssetRecord(rest)).toBe(false);
  });
});

describe('mergeAssetLibrary', () => {
  it('저장 문서가 비어 있으면 원천 그대로 나온다', () => {
    const { assets } = mergeAssetLibrary([source], document());
    expect(assets).toEqual([buildBuiltinAssetRecord(source)]);
  });

  it('저장된 메타데이터가 이기고 정체성(종류·경로·스케일)은 원천이 이긴다', () => {
    const stored = asset({
      id: 'okpo-ttc',
      origin: 'builtin',
      kind: 'map',
      name: '옥포 타워크레인',
      sites: ['okpo'],
      tags: ['crane'],
      defaultScale: [9, 9, 9],
      catalogId: 'stale-id',
      versions: [
        version({
          status: 'withdrawn',
          note: '교체 예정',
          file: {
            ref: { storage: 'public', path: '/models/old-name.glb' },
            fileName: 'old-name.glb',
            format: 'glb',
            sizeBytes: 123,
            contentHash: 'sha256:abc',
          },
        }),
      ],
    });
    const { assets } = mergeAssetLibrary([source], document([stored]));
    expect(assets[0]).toMatchObject({
      name: '옥포 타워크레인',
      sites: ['okpo'],
      tags: ['crane'],
      kind: 'model',
      origin: 'builtin',
      catalogId: 'okpo-ttc',
      defaultScale: [1, 1, 1],
    });
    // 버전 1 의 상태·메모는 저장본, 파일 경로는 카탈로그.
    expect(assets[0].versions[0]).toMatchObject({
      status: 'withdrawn',
      note: '교체 예정',
      file: {
        ref: { storage: 'public', path: '/models/okpo_ttc.glb' },
        fileName: 'okpo_ttc.glb',
        sizeBytes: 123,
        contentHash: 'sha256:abc',
      },
    });
  });

  it('저장본의 추가 버전과 현재 버전 포인터를 유지한다', () => {
    const stored = asset({
      id: 'okpo-ttc',
      origin: 'builtin',
      versions: [version(), version({ version: 2, status: 'draft' })],
      currentVersion: 2,
    });
    const { assets } = mergeAssetLibrary([source], document([stored]));
    expect(assets[0].versions.map((v) => v.version)).toEqual([1, 2]);
    expect(assets[0].currentVersion).toBe(2);
  });

  it('저장본에 버전 1 이 없으면 원천의 버전 1 을 넣고 포인터를 맞춘다', () => {
    const stored = asset({
      id: 'okpo-ttc',
      origin: 'builtin',
      versions: [version({ version: 5 })],
      currentVersion: 9,
    });
    const { assets } = mergeAssetLibrary([source], document([stored]));
    expect(assets[0].versions.map((v) => v.version)).toEqual([1, 5]);
    expect(assets[0].currentVersion).toBe(1);
  });

  it('원천에서 빠진 builtin 은 저장본에 남아 있어도 사라진다', () => {
    const orphan = asset({ id: 'removed', origin: 'builtin' });
    const { assets } = mergeAssetLibrary([source], document([orphan]));
    expect(assets.map((a) => a.id)).toEqual(['okpo-ttc']);
  });

  it('사용자 자산은 builtin 뒤에 등록 시각 순으로 붙고 builtin id 와 겹치면 버린다', () => {
    const later = asset({ id: 'later', createdAt: '2026-03-01T00:00:00.000Z' });
    const earlier = asset({ id: 'earlier', createdAt: '2026-02-01T00:00:00.000Z' });
    const clash = asset({ id: 'okpo-ttc', origin: 'user', name: 'Impostor' });
    const { assets } = mergeAssetLibrary(
      [source],
      document([later, clash, earlier]),
    );
    expect(assets.map((a) => a.id)).toEqual(['okpo-ttc', 'earlier', 'later']);
    // id 가 겹친 사용자 레코드는 builtin 의 메타데이터가 되지 않는다.
    expect(assets[0]).toMatchObject({ origin: 'builtin', name: 'Okpo TTC' });
  });

  it('원천에 같은 id 가 두 번 있으면 먼저 온 것만 쓴다', () => {
    const { assets } = mergeAssetLibrary(
      [source, { ...source, name: 'Duplicate' }],
      document(),
    );
    expect(assets).toHaveLength(1);
    expect(assets[0].name).toBe('Okpo TTC');
  });

  it('사라진 자산을 가리키는 컬렉션 항목과 연결을 지운다', () => {
    const user = asset({ id: 'mine', relatedAssetIds: ['okpo-ttc', 'gone'] });
    const { assets, collections } = mergeAssetLibrary([source], {
      schemaVersion: 1,
      assets: [user],
      collections: [{ id: 'c', name: 'C', assetIds: ['gone', 'mine', 'okpo-ttc'] }],
    });
    expect(collections[0].assetIds).toEqual(['mine', 'okpo-ttc']);
    expect(assets.find((a) => a.id === 'mine')?.relatedAssetIds).toEqual([
      'okpo-ttc',
    ]);
  });

  it('연결이 모두 살아 있으면 레코드 참조를 유지한다', () => {
    const user = asset({ id: 'mine', relatedAssetIds: ['okpo-ttc'] });
    const { assets } = mergeAssetLibrary([source], document([user]));
    expect(assets[1]).toBe(user);
  });
});
