import {
  isRulerSize,
  RULER_GUIDE_SIDE_DEFAULT,
  RULER_INTERVALS,
  RULER_MIN_LENGTH,
  RULER_SIZE_DEFAULT,
  type SceneRulerGuideSide,
  type SceneRulerInterval,
  type SceneRulerSize,
} from '../model/ruler-types';
import { normalizeDegrees, numRound, radToDeg } from './math-utils';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 거리 눈금의 순수 계산 — 눈금 위치, 기본 간격, 두 점 → 배치, 숫자 표기,
 * 화면 밀도에 따른 숫자 건너뛰기. 렌더(ui/scene-ruler.tsx)와 에디터(그리기·
 * 인스펙터)가 같은 함수를 쓴다.
 *
 * 길이 단위는 전부 m 다(호출자가 씬 unit 을 `getSceneMetersPerUnit` 으로
 * 환산해 넘긴다). 두 점 → 배치만 씬 unit 그대로다.
 */

/** 한 눈금이 그릴 수 있는 눈금 개수 상한. 넘으면 간격을 정수 배로 올린다. */
export const RULER_MAX_TICKS = 200;

/** 기본 간격은 그린 길이 안에 이만큼의 칸이 들어가는 가장 큰 간격이다. */
export const RULER_DEFAULT_MIN_SPANS = 4;

/**
 * 숫자끼리 이 픽셀보다 가까워지면 건너뛴다 — 기본 크기(M) "800m" 글자 폭에
 * 여백을 더한 값. 다른 크기는 `rulerLabelMinSpacingPx` 가 글자 크기만큼 늘리고
 * 줄인다.
 */
export const RULER_LABEL_MIN_SPACING_PX = 56;

/** 점의 지름(px). M 이 ACMS 그림의 크기다. */
export const RULER_DOT_SIZE_PX: Record<SceneRulerSize, number> = {
  s: 4,
  m: 6,
  l: 8,
};

/** 숫자의 글자 크기(px). M 이 ACMS 그림의 크기다. */
export const RULER_TEXT_SIZE_PX: Record<SceneRulerSize, number> = {
  s: 11,
  m: 13,
  l: 16,
};

/** 모르는 값(누락·오타)은 기본 크기로 본다. */
function resolveRulerSize(size: unknown): SceneRulerSize {
  return isRulerSize(size) ? size : RULER_SIZE_DEFAULT;
}

export function rulerDotSizePx(size?: SceneRulerSize): number {
  return RULER_DOT_SIZE_PX[resolveRulerSize(size)];
}

/** 점의 중심까지의 거리(px) — 점을 눈금 자리에 맞추고 축소하는 기준점. */
export function rulerDotCenterPx(size?: SceneRulerSize): number {
  return rulerDotSizePx(size) / 2;
}

export function rulerTextSizePx(size?: SceneRulerSize): number {
  return RULER_TEXT_SIZE_PX[resolveRulerSize(size)];
}

/** 숫자 건너뛰기의 기준 간격(px) — 글자가 커진 만큼 넓어진다. */
export function rulerLabelMinSpacingPx(size?: SceneRulerSize): number {
  return (
    (RULER_LABEL_MIN_SPACING_PX * rulerTextSizePx(size)) /
    RULER_TEXT_SIZE_PX[RULER_SIZE_DEFAULT]
  );
}

/** 숫자 건너뛰기 배수 후보(오름차순). */
export const RULER_LABEL_STRIDES = [1, 2, 5, 10, 20, 50, 100] as const;

/** 보조선을 바닥에서 띄우는 높이(m) — 지도의 얹힌 표시(0.1) 위. */
export const RULER_LINE_LIFT_M = 0.3;

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export interface RulerTick {
  /** 눈금 값 ÷ 간격(정수). 숫자 건너뛰기가 이 값의 배수로 고른다. */
  index: number;
  /** 눈금에 적히는 값(m). */
  value: number;
  /** 시작점에서의 거리(m), [0, lengthM]. */
  distance: number;
}

export interface RulerTickParams {
  lengthM: number;
  interval: number;
  startValue?: number;
  maxTicks?: number;
}

/**
 * 실제로 쓰는 간격. 눈금 개수가 상한을 넘으면 간격을 정수 배로 올린다 —
 * 정수 배라야 남는 눈금이 원래 눈금 자리에 그대로 선다.
 */
export function resolveRulerInterval({
  lengthM,
  interval,
  startValue = 0,
  maxTicks = RULER_MAX_TICKS,
}: RulerTickParams): number {
  if (!isPositive(lengthM) || !isPositive(interval)) return 0;
  const count = countTicks(lengthM, interval, startValue);
  if (!isPositive(maxTicks) || count <= maxTicks) return interval;
  return interval * Math.ceil(count / maxTicks);
}

function tickIndexRange(
  lengthM: number,
  interval: number,
  startValue: number,
): [number, number] {
  // 경계가 부동소수 오차로 빠지지 않게 간격에 비례한 여유를 둔다
  // (0.1 × 3 = 0.30000000000000004 가 길이 0.3 의 끝 눈금을 잃지 않도록).
  const eps = 1e-9;
  // `+ 0` 은 -0 을 0 으로 바꾼다 — Math.ceil(-1e-9) 는 -0 이고, 그대로 두면
  // 첫 눈금의 값과 인덱스가 -0 이 된다.
  const first = Math.ceil(startValue / interval - eps) + 0;
  const last = Math.floor((startValue + lengthM) / interval + eps) + 0;
  return [first, last];
}

function countTicks(
  lengthM: number,
  interval: number,
  startValue: number,
): number {
  const [first, last] = tickIndexRange(lengthM, interval, startValue);
  return Math.max(0, last - first + 1);
}

/**
 * 눈금 목록. 눈금은 시작점이 아니라 **간격의 배수 값**에 선다 — 시작 값이
 * 150 이고 간격이 100 이면 200·300… 에 선다(시작 값 0 이면 0·100…).
 * 잘못된 입력(비유한·0 이하)은 빈 배열.
 */
export function rulerTicks(params: RulerTickParams): RulerTick[] {
  const { lengthM } = params;
  const startValue = Number.isFinite(params.startValue)
    ? (params.startValue as number)
    : 0;
  const interval = resolveRulerInterval({ ...params, startValue });
  if (interval <= 0) return [];
  const [first, last] = tickIndexRange(lengthM, interval, startValue);
  const ticks: RulerTick[] = [];
  for (let index = first; index <= last; index += 1) {
    // 값은 누적 덧셈이 아니라 곱으로 — 0.1 을 300 번 더한 오차를 피한다.
    const value = index * interval;
    ticks.push({
      index,
      value,
      distance: Math.min(lengthM, Math.max(0, value - startValue)),
    });
  }
  return ticks;
}

/**
 * 그린 길이에 맞는 기본 간격(m). 고를 수 있는 간격 중 칸 수가 충분한 가장 큰
 * 값이고, 짧아서 어느 것도 충분하지 않으면 가장 작은 간격이다.
 */
export function pickRulerInterval(lengthM: number): SceneRulerInterval {
  const smallest = RULER_INTERVALS[0];
  if (!isPositive(lengthM)) return smallest;
  let picked: SceneRulerInterval = smallest;
  for (const candidate of RULER_INTERVALS) {
    if (lengthM / candidate >= RULER_DEFAULT_MIN_SPANS) picked = candidate;
  }
  return picked;
}

export interface RulerPlacement {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  /** 씬 unit. */
  length: number;
}

/**
 * 찍은 두 점 → 눈금 배치. 눈금은 시작점 높이의 수평면에 놓이므로 길이는
 * 수평(XZ) 거리이고 끝점의 높이는 쓰지 않는다. 로컬 +X 가 끝점을 향하도록
 * Y 회전을 정한다(three 의 Y 회전 θ 는 +X 를 (cos θ, 0, −sin θ) 로 보낸다).
 * 너무 짧거나 좌표가 깨졌으면 null.
 */
export function rulerPlacementFromPoints(
  start: Vector3Tuple,
  end: Vector3Tuple,
): RulerPlacement | null {
  if (![...start, ...end].every((v) => Number.isFinite(v))) return null;
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const length = Math.hypot(dx, dz);
  if (length < RULER_MIN_LENGTH) return null;
  const yaw = normalizeDegrees(numRound(radToDeg(Math.atan2(-dz, dx)), 1));
  return {
    position: [numRound(start[0]), numRound(start[1]), numRound(start[2])],
    rotation: [0, yaw, 0],
    length: numRound(length),
  };
}

/** 간격의 소수 자릿수(최대 2) — 숫자 표기가 간격과 같은 자릿수를 쓴다. */
function intervalDecimals(interval: number): number {
  for (let decimals = 0; decimals <= 2; decimals += 1) {
    const scaled = interval * 10 ** decimals;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return decimals;
  }
  return 2;
}

/** 눈금 숫자 표기 — `800m` 또는 `800`. */
export function formatRulerValue(
  value: number,
  interval: number,
  unitHidden: boolean,
): string {
  if (!Number.isFinite(value)) return '';
  const decimals = isPositive(interval) ? intervalDecimals(interval) : 0;
  const fixed = value.toFixed(decimals);
  // -0 은 "0" 으로.
  const text = Number(fixed) === 0 ? (0).toFixed(decimals) : fixed;
  return unitHidden ? text : `${text}m`;
}

/**
 * 화면에서 한 칸이 차지하는 픽셀 → 숫자 건너뛰기 배수. 1 이면 전부 표시,
 * 0 이면 전부 숨김(가장 큰 배수로도 겹친다).
 */
export function rulerLabelStride(
  pxPerInterval: number,
  minSpacingPx: number = RULER_LABEL_MIN_SPACING_PX,
): number {
  if (!isPositive(pxPerInterval)) return 0;
  for (const stride of RULER_LABEL_STRIDES) {
    if (pxPerInterval * stride >= minSpacingPx) return stride;
  }
  return 0;
}

/** 이 눈금의 숫자를 지금 배수에서 보일지. */
export function isRulerLabelVisible(index: number, stride: number): boolean {
  if (stride <= 0) return false;
  return index % stride === 0;
}

export interface RulerViewScale {
  /** 원근 카메라의 세로 시야각(도). 직교 카메라면 생략. */
  fovDeg?: number;
  /** 직교 카메라의 화면 세로 크기(월드 unit, zoom 반영). 원근이면 생략. */
  orthoHeight?: number;
  viewportHeightPx: number;
}

/**
 * 카메라에서 `distance` 만큼 떨어진 곳의 월드 1 unit 이 화면에서 몇 픽셀인지.
 * 직교 카메라는 거리와 무관하다. 계산할 수 없으면 0.
 */
export function pixelsPerUnitAtDistance(
  view: RulerViewScale,
  distance: number,
): number {
  if (!isPositive(view.viewportHeightPx)) return 0;
  if (view.orthoHeight !== undefined) {
    return isPositive(view.orthoHeight)
      ? view.viewportHeightPx / view.orthoHeight
      : 0;
  }
  if (view.fovDeg === undefined || !isPositive(view.fovDeg)) return 0;
  if (!isPositive(distance)) return 0;
  const visibleHeight = 2 * Math.tan((view.fovDeg * Math.PI) / 360) * distance;
  return isPositive(visibleHeight) ? view.viewportHeightPx / visibleHeight : 0;
}

/**
 * 보조선의 선분 목록(로컬 m, 두 점씩 한 선분) — 눈금 점마다 하나. 점에서
 * 시작해 한쪽으로만 뻗는다. 로컬 +X 가 진행 방향이라 왼쪽은 −Z, 오른쪽은 +Z.
 */
export function rulerGuidePoints(
  ticks: readonly RulerTick[],
  guideLengthM: number,
  side: SceneRulerGuideSide = RULER_GUIDE_SIDE_DEFAULT,
): Vector3Tuple[] {
  if (!isPositive(guideLengthM)) return [];
  const end = side === 'right' ? guideLengthM : -guideLengthM;
  const points: Vector3Tuple[] = [];
  for (const tick of ticks) {
    points.push([tick.distance, 0, 0], [tick.distance, 0, end]);
  }
  return points;
}

/** 선택 표시용 축선(로컬 m) — 시작점에서 끝점까지. */
export function rulerAxisPoints(lengthM: number): Vector3Tuple[] {
  const length = isPositive(lengthM) ? lengthM : 0;
  return [
    [0, 0, 0],
    [length, 0, 0],
  ];
}
