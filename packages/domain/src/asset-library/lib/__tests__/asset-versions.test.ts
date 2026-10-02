import { describe, expect, it } from 'vitest';
import {
  ASSET_HISTORY_MAX,
  ASSET_VERSION_STATUSES,
  ASSET_VERSIONS_MAX,
} from '../../model/types';
import {
  addAssetVersion,
  canRemoveAssetVersion,
  canTransitionStatus,
  createUserAssetRecord,
  diffAssetStats,
  getAllowedStatusTransitions,
  getCurrentAssetVersion,
  getNextAssetVersionNumber,
  METADATA_HISTORY_MERGE_MS,
  removeAssetVersion,
  setAssetThumbnail,
  setAssetVersionStats,
  setCurrentAssetVersion,
  transitionAssetVersionStatus,
  updateAssetMetadata,
  updateAssetVersionNote,
} from '../asset-versions';
import { asset, ctx, version } from './fixtures';

const file = version().file;
const stats = {
  triangles: 100,
  vertices: 80,
  meshes: 1,
  materials: 1,
  textures: 0,
  drawCalls: 1,
  nodes: 2,
  textureMemoryBytes: 0,
  size: null,
  lodLevels: 1,
  animations: 0,
};

describe('상태 전이 표', () => {
  it('허용된 전이만 통과한다', () => {
    const allowed: [string, string][] = [
      ['draft', 'in-review'],
      ['in-review', 'approved'],
      ['in-review', 'rejected'],
      ['approved', 'published'],
      ['rejected', 'in-review'],
      ['published', 'withdrawn'],
      ['withdrawn', 'published'],
    ];
    for (const from of ASSET_VERSION_STATUSES) {
      for (const to of ASSET_VERSION_STATUSES) {
        const expected = allowed.some(([a, b]) => a === from && b === to);
        expect(canTransitionStatus(from, to)).toBe(expected);
      }
    }
  });

  it('같은 상태로의 전이와 검토를 건너뛴 게시는 없다', () => {
    expect(getAllowedStatusTransitions('draft')).toEqual(['in-review']);
    expect(canTransitionStatus('draft', 'published')).toBe(false);
    expect(canTransitionStatus('published', 'published')).toBe(false);
  });
});

describe('transitionAssetVersionStatus', () => {
  it('상태를 바꾸고 이력에 이전·이후를 남긴다', () => {
    const before = asset({ versions: [version({ status: 'draft' })] });
    const after = transitionAssetVersionStatus(before, 1, 'in-review', ctx());
    expect(after.versions[0].status).toBe('in-review');
    expect(after.history.at(-1)).toMatchObject({
      action: 'status',
      version: 1,
      from: 'draft',
      to: 'in-review',
    });
    expect(after.updatedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('표에 없는 전이와 없는 버전은 같은 참조를 돌려준다', () => {
    const before = asset({ versions: [version({ status: 'draft' })] });
    expect(transitionAssetVersionStatus(before, 1, 'published', ctx())).toBe(before);
    expect(transitionAssetVersionStatus(before, 9, 'in-review', ctx())).toBe(before);
  });
});

describe('addAssetVersion', () => {
  it('최댓값 + 1 번호의 draft 를 붙이고 현재 버전은 옮기지 않는다', () => {
    const before = asset({
      versions: [version({ version: 1 }), version({ version: 4 })],
      currentVersion: 4,
    });
    expect(getNextAssetVersionNumber(before)).toBe(5);
    const after = addAssetVersion(before, { file, note: 'n' }, ctx());
    expect(after.versions.at(-1)).toMatchObject({
      version: 5,
      status: 'draft',
      note: 'n',
      createdBy: 'tester',
    });
    expect(after.currentVersion).toBe(4);
    expect(after.history.at(-1)).toMatchObject({
      action: 'version-added',
      version: 5,
    });
  });

  it('리비전·통계가 없으면 필드를 만들지 않는다', () => {
    const added = addAssetVersion(asset(), { file, note: '' }, ctx()).versions.at(-1)!;
    expect('revision' in added).toBe(false);
    expect('stats' in added).toBe(false);
    const withBoth = addAssetVersion(
      asset(),
      { file, note: '', revision: 'B', stats },
      ctx(),
    ).versions.at(-1)!;
    expect(withBoth.revision).toBe('B');
    expect(withBoth.stats).toBe(stats);
  });

  it('버전 상한에서는 같은 참조를 돌려준다(상한 − 1 은 추가된다)', () => {
    const many = (count: number) =>
      asset({
        versions: Array.from({ length: count }, (_, i) =>
          version({ version: i + 1 }),
        ),
      });
    const full = many(ASSET_VERSIONS_MAX);
    expect(addAssetVersion(full, { file, note: '' }, ctx())).toBe(full);
    const almost = many(ASSET_VERSIONS_MAX - 1);
    expect(
      addAssetVersion(almost, { file, note: '' }, ctx()).versions,
    ).toHaveLength(ASSET_VERSIONS_MAX);
  });
});

describe('setCurrentAssetVersion', () => {
  const base = asset({
    versions: [
      version({ version: 1 }),
      version({ version: 2, status: 'draft' }),
      version({ version: 3, status: 'withdrawn' }),
      version({ version: 4, status: 'rejected' }),
    ],
    currentVersion: 1,
  });

  it('포인터를 옮기고 이력을 남긴다', () => {
    const after = setCurrentAssetVersion(base, 2, ctx());
    expect(after.currentVersion).toBe(2);
    expect(after.history.at(-1)).toMatchObject({
      action: 'current-changed',
      from: '1',
      to: '2',
    });
  });

  it('이미 현재이거나, 없는 버전이거나, 철회·반려된 버전이면 같은 참조', () => {
    expect(setCurrentAssetVersion(base, 1, ctx())).toBe(base);
    expect(setCurrentAssetVersion(base, 9, ctx())).toBe(base);
    expect(setCurrentAssetVersion(base, 3, ctx())).toBe(base);
    expect(setCurrentAssetVersion(base, 4, ctx())).toBe(base);
  });
});

describe('getCurrentAssetVersion', () => {
  it('포인터가 깨졌으면 마지막 버전으로 떨어진다', () => {
    const broken = asset({
      versions: [version({ version: 1 }), version({ version: 2 })],
      currentVersion: 7,
    });
    expect(getCurrentAssetVersion(broken).version).toBe(2);
  });
});

describe('updateAssetVersionNote', () => {
  it('메모·리비전을 고치되 이력은 남기지 않는다', () => {
    const before = asset();
    const after = updateAssetVersionNote(before, 1, { note: 'x', revision: 'A' }, ctx());
    expect(after.versions[0]).toMatchObject({ note: 'x', revision: 'A' });
    expect(after.history).toBe(before.history);
  });

  it('빈 리비전은 필드를 지운다', () => {
    const before = asset({ versions: [version({ revision: 'A' })] });
    const after = updateAssetVersionNote(before, 1, { revision: '' }, ctx());
    expect('revision' in after.versions[0]).toBe(false);
  });

  it('같은 값이거나 없는 버전이면 같은 참조', () => {
    const before = asset({ versions: [version({ note: 'x' })] });
    expect(updateAssetVersionNote(before, 1, { note: 'x' }, ctx())).toBe(before);
    expect(updateAssetVersionNote(before, 1, {}, ctx())).toBe(before);
    expect(updateAssetVersionNote(before, 2, { note: 'y' }, ctx())).toBe(before);
  });
});

describe('setAssetVersionStats', () => {
  it('통계를 채우고 이력·수정 시각은 건드리지 않는다', () => {
    const before = asset();
    const after = setAssetVersionStats(before, 1, stats);
    expect(after.versions[0].stats).toBe(stats);
    expect(after.history).toBe(before.history);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(setAssetVersionStats(before, 3, stats)).toBe(before);
  });
});

describe('updateAssetMetadata', () => {
  it('달라진 필드만 반영하고 이력에 필드 이름을 남긴다', () => {
    const before = asset({ name: 'A', tags: ['x'] });
    const after = updateAssetMetadata(
      before,
      { name: 'B', tags: ['x'], owner: 'kim' },
      ctx(),
    );
    expect(after).toMatchObject({ name: 'B', owner: 'kim' });
    expect(after.history.at(-1)).toMatchObject({
      action: 'metadata',
      fields: ['name', 'owner'],
    });
  });

  it('달라진 것이 없으면 같은 참조를 돌려준다', () => {
    const before = asset({ name: 'A', tags: ['x', 'okpo'] });
    expect(
      updateAssetMetadata(before, { name: 'A', tags: ['x', 'okpo'] }, ctx()),
    ).toBe(before);
    expect(updateAssetMetadata(before, {}, ctx())).toBe(before);
    // 없는 도면 번호를 빈 값으로 "고치는" 것도 변화가 아니다.
    expect(updateAssetMetadata(before, { drawingNo: '' }, ctx())).toBe(before);
  });

  it('빈 도면 번호는 필드를 지운다', () => {
    const before = asset({ kind: 'drawing', drawingNo: 'D-1' });
    const after = updateAssetMetadata(before, { drawingNo: '' }, ctx());
    expect('drawingNo' in after).toBe(false);
  });

  it('builtin 자산의 종류·기본 스케일 변경은 무시한다', () => {
    const builtin = asset({ origin: 'builtin' });
    expect(
      updateAssetMetadata(builtin, { kind: 'map', defaultScale: [2, 2, 2] }, ctx()),
    ).toBe(builtin);
    const user = asset({ origin: 'user' });
    expect(
      updateAssetMetadata(user, { kind: 'map', defaultScale: [2, 2, 2] }, ctx()),
    ).toMatchObject({ kind: 'map', defaultScale: [2, 2, 2] });
  });

  it('같은 사람이 병합 창 안에 이어 고치면 이력 한 줄로 묶는다', () => {
    const t0 = Date.parse('2026-02-01T00:00:00.000Z');
    const iso = (ms: number) => new Date(ms).toISOString();
    const first = updateAssetMetadata(asset(), { name: 'B' }, ctx(iso(t0)));
    const merged = updateAssetMetadata(
      first,
      { description: 'd' },
      ctx(iso(t0 + METADATA_HISTORY_MERGE_MS)),
    );
    expect(merged.history).toHaveLength(1);
    expect(merged.history[0].fields).toEqual(['name', 'description']);
    expect(merged.history[0].at).toBe(iso(t0 + METADATA_HISTORY_MERGE_MS));

    // 창을 1ms 넘기면 새 줄.
    const separate = updateAssetMetadata(
      first,
      { description: 'd' },
      ctx(iso(t0 + METADATA_HISTORY_MERGE_MS + 1)),
    );
    expect(separate.history).toHaveLength(2);
    // 다른 사람이면 새 줄.
    const other = updateAssetMetadata(
      first,
      { description: 'd' },
      ctx(iso(t0 + 1000), 'someone-else'),
    );
    expect(other.history).toHaveLength(2);
  });

  it('이력은 상한을 넘으면 오래된 것부터 버린다', () => {
    const history = Array.from({ length: ASSET_HISTORY_MAX }, (_, i) => ({
      id: `h${i}`,
      at: '2026-01-01T00:00:00.000Z',
      actor: 'old',
      action: 'status' as const,
    }));
    const after = updateAssetMetadata(asset({ history }), { name: 'New' }, ctx());
    expect(after.history).toHaveLength(ASSET_HISTORY_MAX);
    expect(after.history[0].id).toBe('h1');
    expect(after.history.at(-1)?.action).toBe('metadata');
  });
});

describe('setAssetThumbnail', () => {
  it('썸네일을 붙이고 이력을 남긴다', () => {
    const thumbnail = {
      ref: { storage: 'public' as const, path: '/asset-library/thumbnails/a.png' },
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    const after = setAssetThumbnail(asset(), thumbnail, ctx());
    expect(after.thumbnail).toBe(thumbnail);
    expect(after.history.at(-1)?.action).toBe('thumbnail');
  });

  it('컨텍스트가 없으면(자동 생성) 이력을 남기지 않는다', () => {
    const thumbnail = {
      ref: { storage: 'public' as const, path: '/asset-library/thumbnails/a.png' },
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    const before = asset();
    const after = setAssetThumbnail(before, thumbnail, null);
    expect(after.thumbnail).toBe(thumbnail);
    expect(after.history).toBe(before.history);
  });
});

describe('createUserAssetRecord', () => {
  it('버전 1(draft)과 생성 이력으로 시작하고 등록자가 담당자가 된다', () => {
    const record = createUserAssetRecord(
      {
        id: 'new-asset',
        kind: 'drawing',
        name: 'New',
        description: '',
        tags: ['philly'],
        file,
        drawingNo: 'D-100',
        revision: 'A',
      },
      ctx('2026-03-01T00:00:00.000Z', 'crane.ocean'),
    );
    expect(record).toMatchObject({
      origin: 'user',
      owner: 'crane.ocean',
      currentVersion: 1,
      drawingNo: 'D-100',
      createdAt: '2026-03-01T00:00:00.000Z',
    });
    expect(record.versions[0]).toMatchObject({
      version: 1,
      status: 'draft',
      revision: 'A',
      // 첫 버전은 변경 메모 없이 시작한다.
      note: '',
    });
    expect(record.history).toEqual([
      expect.objectContaining({ action: 'created', version: 1 }),
    ]);
  });
});

describe('diffAssetStats', () => {
  it('다음 − 이전을 돌려주고 한쪽이 없으면 null', () => {
    expect(
      diffAssetStats(stats, { ...stats, triangles: 60, drawCalls: 4 }),
    ).toEqual({ triangles: -40, vertices: 0, drawCalls: 3, textureMemoryBytes: 0 });
    expect(diffAssetStats(undefined, stats)).toBeNull();
    expect(diffAssetStats(stats, undefined)).toBeNull();
  });
});

describe('버전 지우기', () => {
  const ctx = { entryId: 'e', at: '2026-10-01T00:00:00.000Z', actor: 'me' };
  const withVersions = () =>
    asset({
      versions: [
        version({ version: 1, status: 'published' }),
        version({ version: 2, status: 'draft' }),
        version({ version: 3, status: 'rejected' }),
        version({ version: 4, status: 'in-review' }),
        version({ version: 5, status: 'withdrawn' }),
      ],
      currentVersion: 1,
    });

  it('초안·반려만 지울 수 있다', () => {
    const record = withVersions();
    expect(canRemoveAssetVersion(record, 2)).toBe(true);
    expect(canRemoveAssetVersion(record, 3)).toBe(true);
    expect(canRemoveAssetVersion(record, 4)).toBe(false);
    expect(canRemoveAssetVersion(record, 5)).toBe(false);
  });

  it('현재 버전·없는 버전·마지막 남은 버전은 지울 수 없다', () => {
    const record = withVersions();
    expect(canRemoveAssetVersion(record, 1)).toBe(false);
    expect(canRemoveAssetVersion(record, 99)).toBe(false);
    const draftCurrent = asset({
      versions: [version({ version: 1, status: 'draft' })],
      currentVersion: 1,
    });
    expect(canRemoveAssetVersion(draftCurrent, 1)).toBe(false);
    const onlyOne = asset({
      versions: [version({ version: 2, status: 'draft' })],
      currentVersion: 1,
    });
    expect(canRemoveAssetVersion(onlyOne, 2)).toBe(false);
  });

  it('지우면 버전이 빠지고 이력이 남는다', () => {
    const record = withVersions();
    const next = removeAssetVersion(record, 2, ctx);
    expect(next.versions.map((v) => v.version)).toEqual([1, 3, 4, 5]);
    expect(next.currentVersion).toBe(1);
    expect(next.history.at(-1)).toMatchObject({
      action: 'version-removed',
      version: 2,
      actor: 'me',
    });
  });

  it('지울 수 없는 버전은 같은 참조를 돌려준다', () => {
    const record = withVersions();
    expect(removeAssetVersion(record, 1, ctx)).toBe(record);
    expect(removeAssetVersion(record, 99, ctx)).toBe(record);
  });

  it('지운 번호는 다시 쓰지 않는다', () => {
    const record = asset({
      versions: [
        version({ version: 1, status: 'published' }),
        version({ version: 2, status: 'draft' }),
      ],
      currentVersion: 1,
    });
    const removed = removeAssetVersion(record, 2, ctx);
    expect(removed.versions.map((v) => v.version)).toEqual([1]);
    expect(getNextAssetVersionNumber(removed)).toBe(3);
  });
});
