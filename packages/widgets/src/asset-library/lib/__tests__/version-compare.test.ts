import { describe, expect, it } from 'vitest';
import type { AssetStats } from '@crane/domain/asset-library';
import {
  compareVersions,
  dropUnknownRows,
  formatRatio,
  pickDefaultCompareVersion,
  resolveCompareVersion,
  VERSION_COMPARE_METRICS,
  type VersionCompareSide,
} from '../version-compare';

const stats = (patch: Partial<AssetStats> = {}): AssetStats => ({
  triangles: 1000,
  vertices: 600,
  meshes: 4,
  materials: 2,
  textures: 3,
  drawCalls: 4,
  nodes: 9,
  textureMemoryBytes: 4096,
  size: [1, 2, 3],
  lodLevels: 1,
  animations: 0,
  ...patch,
});

const side = (patch: Partial<VersionCompareSide> = {}): VersionCompareSide => ({
  sizeBytes: 2000,
  stats: stats(),
  meters: [10, 20, 30],
  ...patch,
});

const row = (rows: ReturnType<typeof compareVersions>, metric: string) =>
  rows.find((item) => item.metric === metric)!;

describe('compareVersions', () => {
  it('모든 지표를 정해진 순서로 낸다', () => {
    expect(compareVersions(side(), side()).map((r) => r.metric)).toEqual([
      ...VERSION_COMPARE_METRICS,
    ]);
  });

  it('같은 내용이면 달라진 줄이 없다', () => {
    const rows = compareVersions(side(), side());
    expect(rows.every((r) => !r.changed && r.delta === 0 && r.ratio === null)).toBe(
      true,
    );
  });

  it('증감과 변화율을 낸다', () => {
    const rows = compareVersions(
      side(),
      side({ sizeBytes: 3000, stats: stats({ triangles: 500 }) }),
    );
    expect(row(rows, 'sizeBytes')).toMatchObject({
      base: 2000,
      target: 3000,
      delta: 1000,
      ratio: 0.5,
      changed: true,
      unit: 'bytes',
    });
    expect(row(rows, 'triangles')).toMatchObject({ delta: -500, ratio: -0.5 });
    expect(row(rows, 'vertices').changed).toBe(false);
  });

  it('치수는 [폭, 높이, 깊이] 를 각 줄에 맞게 읽는다', () => {
    const rows = compareVersions(side(), side({ meters: [11, 22, 33] }));
    expect(row(rows, 'width').delta).toBe(1);
    expect(row(rows, 'height').delta).toBe(2);
    expect(row(rows, 'depth').delta).toBe(3);
  });

  it('치수는 1mm 미만 차이를 같다고 보고, 그보다 크면 달라진 것', () => {
    const under = compareVersions(side(), side({ meters: [10.0009, 20, 30] }));
    expect(row(under, 'width')).toMatchObject({ changed: false, delta: 0 });
    const at = compareVersions(side(), side({ meters: [10.5, 20, 30] }));
    expect(row(at, 'width').changed).toBe(true);
  });

  it('어느 한쪽을 모르면 차이를 말하지 않는다', () => {
    const rows = compareVersions(side({ stats: null, meters: null }), side());
    expect(row(rows, 'triangles')).toMatchObject({
      base: null,
      target: 1000,
      delta: null,
      ratio: null,
      changed: false,
    });
    expect(row(rows, 'width').base).toBeNull();
    expect(row(rows, 'sizeBytes').changed).toBe(false);
  });

  it('기준값이 0 이면 변화율은 없다(0 으로 나누지 않는다)', () => {
    const rows = compareVersions(
      side({ stats: stats({ textures: 0 }) }),
      side({ stats: stats({ textures: 5 }) }),
    );
    expect(row(rows, 'textures')).toMatchObject({ delta: 5, ratio: null });
  });

  it('NaN·Infinity 는 모르는 값으로 본다', () => {
    const rows = compareVersions(
      side({ sizeBytes: Number.NaN, stats: stats({ triangles: Infinity }) }),
      side(),
    );
    expect(row(rows, 'sizeBytes').base).toBeNull();
    expect(row(rows, 'triangles').base).toBeNull();
  });
});

describe('dropUnknownRows', () => {
  it('양쪽 다 모르는 줄만 뺀다', () => {
    const rows = dropUnknownRows(
      compareVersions(
        side({ stats: null, meters: null }),
        side({ stats: null, meters: [1, 2, 3] }),
      ),
    );
    expect(rows.map((r) => r.metric)).toEqual([
      'sizeBytes',
      'width',
      'depth',
      'height',
    ]);
    expect(dropUnknownRows([])).toEqual([]);
  });
});

describe('resolveCompareVersion', () => {
  const versions = [{ version: 1 }, { version: 2 }, { version: 4 }];
  it('있는 다른 버전만 받는다', () => {
    expect(resolveCompareVersion(1, 2, versions)).toBe(1);
    expect(resolveCompareVersion(2, 2, versions)).toBeNull();
    expect(resolveCompareVersion(3, 2, versions)).toBeNull();
    expect(resolveCompareVersion(null, 2, versions)).toBeNull();
  });
});

describe('pickDefaultCompareVersion', () => {
  const versions = [{ version: 4 }, { version: 1 }, { version: 2 }];
  it('바로 앞 버전, 없으면 가장 가까운 뒤 버전', () => {
    expect(pickDefaultCompareVersion(4, versions)).toBe(2);
    expect(pickDefaultCompareVersion(2, versions)).toBe(1);
    expect(pickDefaultCompareVersion(1, versions)).toBe(2);
  });
  it('버전이 하나뿐이면 비교할 것이 없다', () => {
    expect(pickDefaultCompareVersion(1, [{ version: 1 }])).toBeNull();
    expect(pickDefaultCompareVersion(1, [])).toBeNull();
  });
});

describe('formatRatio', () => {
  it('부호와 자릿수', () => {
    expect(formatRatio(0.5)).toBe('+50%');
    expect(formatRatio(-0.5)).toBe('−50%');
    expect(formatRatio(0.034)).toBe('+3.4%');
    expect(formatRatio(0.125)).toBe('+13%');
  });
  it('아주 작은 변화는 0% 로 뭉개지 않는다', () => {
    expect(formatRatio(0.0001)).toBe('+<0.1%');
    expect(formatRatio(-0.0001)).toBe('−<0.1%');
  });
  it('열 배 이상은 배수로', () => {
    expect(formatRatio(9.99)).toBe('+999%');
    expect(formatRatio(10)).toBe('×11');
  });
  it('비정상 값은 빈 문자열', () => {
    expect(formatRatio(Number.NaN)).toBe('');
    expect(formatRatio(Infinity)).toBe('');
  });
});
