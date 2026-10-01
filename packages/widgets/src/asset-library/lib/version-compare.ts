import type { AssetStats } from '@crane/domain/asset-library';

/**
 * 두 버전의 수치 비교 — 기준(base) 버전에서 대상(target) 버전으로 무엇이
 * 얼마나 달라졌는지. 관리자가 새 버전을 승인하기 전에 "무거워졌나" 를 한
 * 표로 본다.
 */

export const VERSION_COMPARE_METRICS = [
  'sizeBytes',
  'triangles',
  'vertices',
  'meshes',
  'materials',
  'textures',
  'drawCalls',
  'textureMemoryBytes',
  'width',
  'depth',
  'height',
] as const;
export type VersionCompareMetric = (typeof VERSION_COMPARE_METRICS)[number];

export type VersionCompareUnit = 'bytes' | 'count' | 'meters';

const METRIC_UNIT: Record<VersionCompareMetric, VersionCompareUnit> = {
  sizeBytes: 'bytes',
  triangles: 'count',
  vertices: 'count',
  meshes: 'count',
  materials: 'count',
  textures: 'count',
  drawCalls: 'count',
  textureMemoryBytes: 'bytes',
  width: 'meters',
  depth: 'meters',
  height: 'meters',
};

/** 치수는 이보다 작은 차이를 같다고 본다(부동소수 오차·압축 양자화). */
const METERS_EPSILON = 0.001;

export interface VersionCompareSide {
  sizeBytes: number | null;
  stats: AssetStats | null;
  /** m 단위 [폭(X), 높이(Y), 깊이(Z)]. */
  meters: readonly [number, number, number] | null;
}

export interface VersionCompareRow {
  metric: VersionCompareMetric;
  unit: VersionCompareUnit;
  base: number | null;
  target: number | null;
  /** target − base. 어느 한쪽을 모르면 null. */
  delta: number | null;
  /** base 대비 변화율(0.1 = +10%). base 가 0 이거나 모르면 null. */
  ratio: number | null;
  /** 값이 달라졌는가. 어느 한쪽을 모르면 false(다르다고 말할 수 없다). */
  changed: boolean;
}

function readMetric(
  side: VersionCompareSide,
  metric: VersionCompareMetric,
): number | null {
  switch (metric) {
    case 'sizeBytes':
      return side.sizeBytes;
    case 'width':
      return side.meters?.[0] ?? null;
    case 'height':
      return side.meters?.[1] ?? null;
    case 'depth':
      return side.meters?.[2] ?? null;
    default:
      return side.stats?.[metric] ?? null;
  }
}

function finite(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

export function compareVersions(
  base: VersionCompareSide,
  target: VersionCompareSide,
): VersionCompareRow[] {
  return VERSION_COMPARE_METRICS.map((metric) => {
    const unit = METRIC_UNIT[metric];
    const from = finite(readMetric(base, metric));
    const to = finite(readMetric(target, metric));
    const delta = from !== null && to !== null ? to - from : null;
    const changed =
      delta !== null &&
      (unit === 'meters' ? Math.abs(delta) >= METERS_EPSILON : delta !== 0);
    return {
      metric,
      unit,
      base: from,
      target: to,
      delta: changed ? delta : delta === null ? null : 0,
      ratio:
        changed && delta !== null && from !== null && from !== 0
          ? delta / from
          : null,
      changed,
    };
  });
}

/** 양쪽 다 값을 모르는 줄은 표에서 뺀다(도면에는 삼각형 수가 없다). */
export function dropUnknownRows(
  rows: readonly VersionCompareRow[],
): VersionCompareRow[] {
  return rows.filter((row) => row.base !== null || row.target !== null);
}

/**
 * `?compare=` 로 받은 기준 버전 번호를 확정한다. 보고 있는 버전과 같거나
 * 없는 번호면 비교하지 않는다(null).
 */
export function resolveCompareVersion(
  requested: number | null,
  viewedVersion: number,
  versions: readonly { version: number }[],
): number | null {
  if (requested === null || requested === viewedVersion) return null;
  return versions.some((item) => item.version === requested) ? requested : null;
}

/** 비교를 처음 켤 때의 기준 — 보고 있는 버전 바로 앞 버전, 없으면 바로 뒤. */
export function pickDefaultCompareVersion(
  viewedVersion: number,
  versions: readonly { version: number }[],
): number | null {
  const numbers = versions
    .map((item) => item.version)
    .filter((version) => version !== viewedVersion)
    .sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  const older = numbers.filter((version) => version < viewedVersion);
  return older.length > 0 ? older[older.length - 1] : numbers[0];
}

/** 변화율 표기 — `+12.5%`, `−3%`. 1000% 이상은 배수로(`×12`). */
export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return '';
  const percent = ratio * 100;
  if (percent >= 1000) return `×${Math.round(ratio + 1)}`;
  const rounded =
    Math.abs(percent) >= 10 ? Math.round(percent) : Math.round(percent * 10) / 10;
  if (rounded === 0) return percent > 0 ? '+<0.1%' : '−<0.1%';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}%`;
}
