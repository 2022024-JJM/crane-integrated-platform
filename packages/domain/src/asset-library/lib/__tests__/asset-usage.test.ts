import { describe, expect, it } from 'vitest';
import {
  buildAssetUsageIndex,
  countAssetPlacements,
  getAssetRemoveBlock,
  getAssetUsage,
  getAssetVersionUsage,
  getAssetWithdrawBlock,
  isAssetInUse,
  isAssetVersionInUse,
  type AssetUsageSource,
} from '../asset-usage';
import { asset, version } from './fixtures';

const ref = (id: string, v: number, path = `/models/${id}.glb`) => ({
  path,
  asset: { id, version: v },
});

const okpo: AssetUsageSource = {
  kind: 'scene',
  name: 'okpo.json',
  regionIds: ['dock-1', 'dock-2'],
  editorPath: '/outdoor-work/dock-1/3d-viewer-edit',
  refs: [
    ref('asset-a', 1),
    ref('asset-a', 1),
    ref('asset-b', 1),
    ref('map-okpo', 1, '/maps/okpo.glb'),
  ],
};
const philly: AssetUsageSource = {
  kind: 'scene',
  name: 'philly.json',
  regionIds: ['philly-dock-2'],
  editorPath: '/outdoor-work/philly-dock-2/3d-viewer-edit',
  refs: [ref('asset-a', 2)],
};
/** 자산 참조를 적기 전의 저장본 — 경로만 있다. */
const legacy: AssetUsageSource = {
  kind: 'scene',
  name: 'legacy.json',
  regionIds: ['dock-in'],
  editorPath: '',
  refs: [{ path: '/models/a.glb' }, { path: '/models/a.glb' }, { path: '' }],
};
const code: AssetUsageSource = {
  kind: 'code',
  name: 'crane-type-model',
  regionIds: [],
  editorPath: '',
  refs: [ref('asset-a', 1)],
};

const file = (path: string) => ({
  ...version().file,
  ref: { storage: 'public' as const, path },
});

/** v1 은 /models/a.glb, v2 는 라이브러리 경로. */
const record = asset({
  id: 'asset-a',
  versions: [
    version({ version: 1, file: file('/models/a.glb') }),
    version({
      version: 2,
      file: file('/asset-library/files/asset-a/v2/a.glb'),
    }),
  ],
});

describe('buildAssetUsageIndex', () => {
  it('씬이 없으면 빈 인덱스', () => {
    expect(buildAssetUsageIndex([]).size).toBe(0);
  });

  it('참조도 경로도 없는 자리는 세지 않는다', () => {
    const index = buildAssetUsageIndex([
      { ...legacy, refs: [{ path: '' }] },
    ]);
    expect(index.size).toBe(0);
  });
});

describe('getAssetVersionUsage', () => {
  it('자산 id 와 버전으로 그 버전을 쓰는 곳을 센다', () => {
    const index = buildAssetUsageIndex([okpo, philly]);
    expect(getAssetVersionUsage(record, 1, index)).toEqual([
      {
        kind: 'scene',
        name: 'okpo.json',
        regionIds: ['dock-1', 'dock-2'],
        editorPath: '/outdoor-work/dock-1/3d-viewer-edit',
        count: 2,
      },
    ]);
    expect(getAssetVersionUsage(record, 2, index)).toEqual([
      expect.objectContaining({ name: 'philly.json', count: 1 }),
    ]);
  });

  it('버전이 다르면 같은 자산이어도 다른 사용처다', () => {
    const index = buildAssetUsageIndex([philly]);
    expect(getAssetVersionUsage(record, 1, index)).toEqual([]);
    expect(getAssetVersionUsage(record, 2, index)).toHaveLength(1);
  });

  it('참조가 없는 자리는 그 버전의 파일 경로로 매칭한다', () => {
    const index = buildAssetUsageIndex([legacy]);
    expect(getAssetVersionUsage(record, 1, index)).toEqual([
      expect.objectContaining({ name: 'legacy.json', count: 2 }),
    ]);
    // 경로가 다른 버전은 걸리지 않는다.
    expect(getAssetVersionUsage(record, 2, index)).toEqual([]);
  });

  it('같은 씬이 참조로도 경로로도 잡히면 한 줄로 합친다', () => {
    const mixed: AssetUsageSource = {
      ...okpo,
      refs: [ref('asset-a', 1), { path: '/models/a.glb' }],
    };
    const index = buildAssetUsageIndex([mixed]);
    expect(getAssetVersionUsage(record, 1, index)).toEqual([
      expect.objectContaining({ name: 'okpo.json', count: 2 }),
    ]);
  });

  it('코드 사용처는 씬과 따로 한 줄이다', () => {
    const index = buildAssetUsageIndex([okpo, code]);
    expect(
      getAssetVersionUsage(record, 1, index).map((usage) => [
        usage.kind,
        usage.name,
        usage.count,
      ]),
    ).toEqual([
      ['scene', 'okpo.json', 2],
      ['code', 'crane-type-model', 1],
    ]);
  });

  it('없는 버전은 빈 배열', () => {
    const index = buildAssetUsageIndex([okpo]);
    expect(getAssetVersionUsage(record, 9, index)).toEqual([]);
  });

  it('브라우저에만 있는 버전은 경로가 같아 보여도 경로로 매칭하지 않는다', () => {
    const local = asset({
      id: 'local',
      versions: [
        version({
          file: {
            ...version().file,
            ref: { storage: 'browser', key: '/models/a.glb' },
          },
        }),
      ],
    });
    const index = buildAssetUsageIndex([legacy]);
    expect(getAssetVersionUsage(local, 1, index)).toEqual([]);
  });

  it('인덱스의 항목을 고치지 않는다(합칠 때 복사한다)', () => {
    const mixed: AssetUsageSource = {
      ...okpo,
      refs: [ref('asset-a', 1), { path: '/models/a.glb' }],
    };
    const index = buildAssetUsageIndex([mixed]);
    getAssetVersionUsage(record, 1, index);
    expect(getAssetVersionUsage(record, 1, index)[0].count).toBe(2);
  });
});

describe('getAssetUsage / countAssetPlacements', () => {
  it('쓰이는 버전만 버전 순으로 모은다', () => {
    const index = buildAssetUsageIndex([okpo, philly]);
    expect(getAssetUsage(record, index).map((entry) => entry.version)).toEqual(
      [1, 2],
    );
    expect(countAssetPlacements(record, index)).toBe(3);
  });

  it('어디에도 없으면 빈 배열이고 0 이다', () => {
    const index = buildAssetUsageIndex([okpo]);
    const unused = asset({ id: 'nobody' , versions: [
      version({ version: 1, file: file('/models/nobody.glb') }),
    ]});
    expect(getAssetUsage(unused, index)).toEqual([]);
    expect(countAssetPlacements(unused, index)).toBe(0);
  });
});

describe('isAssetVersionInUse / isAssetInUse', () => {
  it('쓰이는 버전만 사용 중이고, 한 버전이라도 쓰이면 자산이 사용 중이다', () => {
    const index = buildAssetUsageIndex([philly]);
    expect(isAssetVersionInUse(record, 1, index)).toBe(false);
    expect(isAssetVersionInUse(record, 2, index)).toBe(true);
    expect(isAssetInUse(record, index)).toBe(true);
  });

  it('코드가 쓰는 것도 사용 중이다', () => {
    const index = buildAssetUsageIndex([code]);
    expect(isAssetVersionInUse(record, 1, index)).toBe(true);
    expect(isAssetInUse(record, index)).toBe(true);
  });

  it('참조 없이 경로로만 놓인 것도 사용 중이다', () => {
    const index = buildAssetUsageIndex([legacy]);
    expect(isAssetInUse(record, index)).toBe(true);
  });

  it('아무도 쓰지 않으면 사용 중이 아니다', () => {
    expect(isAssetInUse(record, buildAssetUsageIndex([]))).toBe(false);
  });
});

describe('getAssetRemoveBlock / getAssetWithdrawBlock', () => {
  const known = (sources: AssetUsageSource[]) => ({
    index: buildAssetUsageIndex(sources),
    known: true,
  });
  const partial = (sources: AssetUsageSource[]) => ({
    index: buildAssetUsageIndex(sources),
    known: false,
  });

  it('쓰이지 않고 사용처를 다 읽었으면 막지 않는다', () => {
    expect(getAssetRemoveBlock(record, known([]))).toBeNull();
    expect(getAssetWithdrawBlock(record, 1, known([]))).toBeNull();
  });

  it('쓰이는 자산은 지울 수 없다 — 어느 버전이 쓰이든', () => {
    expect(getAssetRemoveBlock(record, known([philly]))).toBe('in-use');
  });

  it('철회는 그 버전이 쓰일 때만 막힌다', () => {
    const usage = known([philly]); // v2 만 쓰인다
    expect(getAssetWithdrawBlock(record, 2, usage)).toBe('in-use');
    expect(getAssetWithdrawBlock(record, 1, usage)).toBeNull();
  });

  it('사용처를 다 읽지 못했으면 안 쓰이는 것처럼 보여도 막는다', () => {
    expect(getAssetRemoveBlock(record, partial([]))).toBe('usage-unknown');
    expect(getAssetWithdrawBlock(record, 1, partial([]))).toBe('usage-unknown');
  });

  it('읽은 범위에서 쓰이는 것이 보이면 다 읽지 못했어도 in-use 다(확실한 이유가 먼저)', () => {
    expect(getAssetRemoveBlock(record, partial([okpo]))).toBe('in-use');
  });

  it('씬에 쓰지 않는 종류(도면·CAD)는 씬을 못 읽어도 막지 않는다', () => {
    for (const kind of ['drawing', 'cad'] as const) {
      const doc = asset({ id: 'doc', kind });
      expect(getAssetRemoveBlock(doc, partial([]))).toBeNull();
      expect(getAssetWithdrawBlock(doc, 1, partial([]))).toBeNull();
    }
  });

  it('도면이라도 화면 코드가 쓰면 막는다', () => {
    const drawing = asset({
      id: 'dwg',
      kind: 'drawing',
      versions: [version({ file: file('/drawings/a.webp') })],
    });
    const usage = partial([
      {
        kind: 'code',
        name: 'layout',
        regionIds: [],
        editorPath: '',
        refs: [{ path: '/drawings/a.webp', asset: { id: 'dwg', version: 1 } }],
      },
    ]);
    expect(getAssetRemoveBlock(drawing, usage)).toBe('in-use');
    expect(getAssetWithdrawBlock(drawing, 1, usage)).toBe('in-use');
  });

  it('배경도 씬에 쓰는 종류다 — 다 읽지 못했으면 막는다', () => {
    const sky = asset({ id: 'sky', kind: 'environment' });
    expect(getAssetRemoveBlock(sky, partial([]))).toBe('usage-unknown');
  });

  it('없는 버전의 철회는 막을 이유가 없다(전이 표가 거른다)', () => {
    expect(getAssetWithdrawBlock(record, 9, known([okpo]))).toBeNull();
  });
});
