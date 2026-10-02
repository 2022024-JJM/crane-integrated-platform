import type { Vector3Tuple } from '@crane/core/types/math';
import {
  isGeometryAssetKind,
  type AssetKind,
  type AssetStats,
} from '../model/types';

/** 표시용 변환과 성능 예산 판정 — 화면은 여기서 받은 값을 그리기만 한다. */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** 1024 진법. 100 이상은 정수, 그 아래는 소수 한 자리. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '—';
  }
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}

/** 큰 수를 K·M 으로 줄인다(삼각형·정점 수). */
export function formatCount(count: number | null | undefined): string {
  if (count === null || count === undefined || !Number.isFinite(count)) {
    return '—';
  }
  const abs = Math.abs(count);
  if (abs >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(count / 1_000).toFixed(0)}K`;
  if (abs >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(Math.round(count));
}

/** 부호가 붙은 증감 표기(+1.2K / −340). 0 은 `±0`. */
export function formatSignedCount(delta: number): string {
  if (delta === 0) return '±0';
  return `${delta > 0 ? '+' : '−'}${formatCount(Math.abs(delta))}`;
}

/** 길이(m). 100 m 이상은 소수 한 자리, 그 아래는 두 자리. */
export function formatMeters(meters: number): string {
  if (!Number.isFinite(meters)) return '—';
  const digits = Math.abs(meters) >= 100 ? 1 : 2;
  return `${meters.toFixed(digits)} m`;
}

/**
 * 치수 한 줄 — `폭 × 깊이 × 높이 m`. 입력은 m 단위 [X, Y, Z] 이고 높이는 Y 다.
 * 단위는 끝에 한 번만 적는다. 값이 하나라도 비정상이면 `—`.
 */
export function formatDimensions(meters: Vector3Tuple): string {
  if (!meters.every((value) => Number.isFinite(value))) return '—';
  const [width, height, depth] = meters;
  const number = (value: number) =>
    value.toFixed(Math.abs(value) >= 100 ? 1 : 2);
  return `${number(width)} × ${number(depth)} × ${number(height)} m`;
}

/**
 * 고유 단위 크기를 m 로 바꾼다 — 기본 스케일이 곧 단위 환산 배율이다
 * (스케일 0.1 로 놓는 모델은 고유 단위가 0.1 m).
 */
export function toMeterSize(
  size: Vector3Tuple,
  defaultScale: Vector3Tuple,
): Vector3Tuple {
  return [
    size[0] * defaultScale[0],
    size[1] * defaultScale[1],
    size[2] * defaultScale[2],
  ];
}

/**
 * 바닥 격자 한 칸의 길이. 가장 긴 변이 10~25칸에 걸치도록 1·2·5 × 10ⁿ 에서
 * 고른다 — 칸 수를 세면 크기를 어림할 수 있는 간격이다.
 */
export function pickGridStep(maxExtent: number): number {
  if (!Number.isFinite(maxExtent) || maxExtent <= 0) return 1;
  const raw = maxExtent / 10;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized < 2 ? 1 : normalized < 5 ? 2 : 5;
  return step * magnitude;
}

export const ASSET_BUDGET_METRICS = [
  'triangles',
  'drawCalls',
  'textureMemory',
  'nodes',
] as const;
export type AssetBudgetMetric = (typeof ASSET_BUDGET_METRICS)[number];

export interface AssetBudgetWarning {
  metric: AssetBudgetMetric;
  value: number;
  limit: number;
}

/**
 * 모델 한 개의 권장 상한 — scripts/scene-perf-report.mjs 의 모델 단위 경고
 * 기준과 같은 값이다. 한쪽을 바꾸면 다른 쪽도 함께 바꾼다. 게이트가 아니라
 * 권고이며, 초과해도 등록을 막지 않는다.
 */
export const ASSET_BUDGET = {
  triangles: 200_000,
  drawCalls: 30,
  textureMemoryBytes: 30 * 1024 * 1024,
  nodes: 100,
} as const;

/**
 * 통계가 권장 상한을 넘는 항목을 돌려준다. 지도는 드로우콜·노드 기준에서
 * 뺀다 — 타일·LOD 로 나눈 지형은 노드와 드로우콜이 많은 것이 정상이다.
 */
export function evaluateAssetBudget(
  kind: AssetKind,
  stats: AssetStats,
): AssetBudgetWarning[] {
  if (!isGeometryAssetKind(kind)) return [];
  const warnings: AssetBudgetWarning[] = [];
  const check = (metric: AssetBudgetMetric, value: number, limit: number) => {
    if (value > limit) warnings.push({ metric, value, limit });
  };
  if (kind === 'model') {
    check('triangles', stats.triangles, ASSET_BUDGET.triangles);
    check('drawCalls', stats.drawCalls, ASSET_BUDGET.drawCalls);
    check('nodes', stats.nodes, ASSET_BUDGET.nodes);
  }
  check(
    'textureMemory',
    stats.textureMemoryBytes,
    ASSET_BUDGET.textureMemoryBytes,
  );
  return warnings;
}
