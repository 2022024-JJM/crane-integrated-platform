import {
  isRulerInterval,
  normalizeZoneColor,
  numRound,
  RULER_DEFAULT_COLOR,
  RULER_GUIDE_DEFAULT_LENGTH_M,
  RULER_GUIDE_OPACITY_DEFAULT,
  RULER_GUIDE_OPACITY_MIN,
  RULER_GUIDE_SIDE_DEFAULT,
  type SavedRulerGuide,
  type SavedRulerInfo,
  type SceneRulerGuideSide,
} from '@crane/domain/3d';
import { snapToStep } from '@crane/features/3d';
import { clampToRange } from '@crane/core/lib/utils';
import type { Vector3Tuple } from '@crane/core/types/math';

/**
 * 거리 눈금의 에디터 쪽 순수 로직 — 그리기(클릭 판정·점 스냅·길이 표기)와
 * 인스펙터 눈금 탭의 값 갱신. 눈금 위치·기본 간격 같은 기하는 domain
 * lib/ruler.ts 에 있다.
 *
 * 갱신 함수는 값이 같으면 **같은 참조**를 돌려준다 — updateSelectedRuler 가
 * 그걸 보고 씬을 건드리지 않아 히스토리·dirty 가 오염되지 않는다.
 */

/** 누른 자리와 뗀 자리가 이보다 멀면 클릭이 아니라 드래그(카메라 조작)다. */
export const RULER_DRAW_CLICK_TOLERANCE_PX = 4;

interface ClientPoint {
  clientX: number;
  clientY: number;
}

export function isRulerDrawClick(
  down: ClientPoint | null,
  up: ClientPoint,
  tolerancePx: number = RULER_DRAW_CLICK_TOLERANCE_PX,
): boolean {
  // 누른 자리를 모르면(포인터가 캔버스 밖에서 눌린 경우 등) 클릭으로 본다.
  if (!down) return true;
  return (
    Math.abs(up.clientX - down.clientX) <= tolerancePx &&
    Math.abs(up.clientY - down.clientY) <= tolerancePx
  );
}

/**
 * 찍은 점을 이동 스냅 격자에 맞춘다. 높이(Y)는 바닥 표면값이라 건드리지
 * 않는다. step 이 0 이하면 스냅 없음.
 */
export function snapRulerPoint(
  point: Vector3Tuple,
  step: number,
): Vector3Tuple {
  if (!Number.isFinite(step) || step <= 0) return point;
  const x = snapToStep(point[0], step);
  const z = snapToStep(point[2], step);
  if (x === point[0] && z === point[2]) return point;
  return [x, point[1], z];
}

/** 그리는 중 끝점에 띄우는 길이 표기 — 소수 1자리 m. */
export function formatRulerLength(lengthM: number): string {
  if (!Number.isFinite(lengthM) || lengthM < 0) return '';
  return `${lengthM.toFixed(1)} m`;
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function toMetersPerUnit(metersPerUnit: number): number {
  return isPositive(metersPerUnit) ? metersPerUnit : 1;
}

/** 저장값(씬 unit) → 인스펙터 표시값(m). */
export function rulerUnitsToMeters(
  units: number,
  metersPerUnit: number,
): number {
  return numRound(units * toMetersPerUnit(metersPerUnit));
}

export function withRulerUnitHidden(
  ruler: SavedRulerInfo,
  hidden: boolean,
): SavedRulerInfo {
  if ((ruler.unitHidden === true) === hidden) return ruler;
  const { unitHidden: _unitHidden, ...rest } = ruler;
  void _unitHidden;
  return hidden ? { ...rest, unitHidden: true } : rest;
}

export function withRulerStartValue(
  ruler: SavedRulerInfo,
  startValue: number,
): SavedRulerInfo {
  if (!Number.isFinite(startValue)) return ruler;
  const next = numRound(startValue);
  if ((ruler.startValue ?? 0) === next) return ruler;
  const { startValue: _startValue, ...rest } = ruler;
  void _startValue;
  return next === 0 ? rest : { ...rest, startValue: next };
}

/** 간격(m). 고를 수 있는 값(RULER_INTERVALS)만 받는다 — 그 외는 무시. */
export function withRulerInterval(
  ruler: SavedRulerInfo,
  interval: number,
): SavedRulerInfo {
  if (!isRulerInterval(interval) || ruler.interval === interval) return ruler;
  return { ...ruler, interval };
}

/** 길이(m 입력 → 씬 unit 저장). 0 이하·비유한은 무시. */
export function withRulerLengthMeters(
  ruler: SavedRulerInfo,
  lengthM: number,
  metersPerUnit: number,
): SavedRulerInfo {
  if (!isPositive(lengthM)) return ruler;
  const next = numRound(lengthM / toMetersPerUnit(metersPerUnit));
  if (!isPositive(next) || ruler.length === next) return ruler;
  return { ...ruler, length: next };
}

/** 글자 색 — `#rrggbb` 만 받는다(sanitize 와 같은 규칙). 그 외는 무시. */
export function withRulerTextColor(
  ruler: SavedRulerInfo,
  color: string,
): SavedRulerInfo {
  const next = normalizeZoneColor(color);
  if (!next || ruler.textColor === next) return ruler;
  return { ...ruler, textColor: next };
}

/** 점 색 — 글자 색과 같은 규칙. */
export function withRulerDotColor(
  ruler: SavedRulerInfo,
  color: string,
): SavedRulerInfo {
  const next = normalizeZoneColor(color);
  if (!next || ruler.dotColor === next) return ruler;
  return { ...ruler, dotColor: next };
}

/**
 * 보조선을 켜고 끈다. 켜면 기본값(길이 RULER_GUIDE_DEFAULT_LENGTH_M, 왼쪽,
 * 기본색, 불투명)으로 만들고, 끄면 필드째 지운다.
 */
export function withRulerGuideEnabled(
  ruler: SavedRulerInfo,
  enabled: boolean,
  metersPerUnit: number,
): SavedRulerInfo {
  if ((ruler.guide !== undefined) === enabled) return ruler;
  if (!enabled) {
    const { guide: _guide, ...rest } = ruler;
    void _guide;
    return rest;
  }
  return {
    ...ruler,
    guide: {
      length: numRound(
        RULER_GUIDE_DEFAULT_LENGTH_M / toMetersPerUnit(metersPerUnit),
      ),
      color: RULER_DEFAULT_COLOR,
    },
  };
}

/** 보조선이 있을 때만 고친다. patch 가 같은 참조를 돌려주면 눈금도 그대로다. */
function patchGuide(
  ruler: SavedRulerInfo,
  patch: (guide: SavedRulerGuide) => SavedRulerGuide,
): SavedRulerInfo {
  if (!ruler.guide) return ruler;
  const next = patch(ruler.guide);
  return next === ruler.guide ? ruler : { ...ruler, guide: next };
}

/** 보조선 길이(m 입력 → 씬 unit 저장). 0 이하·비유한은 무시. */
export function withRulerGuideLengthMeters(
  ruler: SavedRulerInfo,
  lengthM: number,
  metersPerUnit: number,
): SavedRulerInfo {
  if (!isPositive(lengthM)) return ruler;
  const next = numRound(lengthM / toMetersPerUnit(metersPerUnit));
  if (!isPositive(next)) return ruler;
  return patchGuide(ruler, (guide) =>
    guide.length === next ? guide : { ...guide, length: next },
  );
}

/** 보조선이 뻗는 쪽. 기본(왼쪽)은 필드를 지운다. */
export function withRulerGuideSide(
  ruler: SavedRulerInfo,
  side: SceneRulerGuideSide,
): SavedRulerInfo {
  return patchGuide(ruler, (guide) => {
    if ((guide.side ?? RULER_GUIDE_SIDE_DEFAULT) === side) return guide;
    const { side: _side, ...rest } = guide;
    void _side;
    return side === 'right' ? { ...rest, side: 'right' } : rest;
  });
}

/** 보조선 색 — `#rrggbb` 만 받는다. */
export function withRulerGuideColor(
  ruler: SavedRulerInfo,
  color: string,
): SavedRulerInfo {
  const next = normalizeZoneColor(color);
  if (!next) return ruler;
  return patchGuide(ruler, (guide) =>
    guide.color === next ? guide : { ...guide, color: next },
  );
}

/**
 * 보조선 불투명도. [RULER_GUIDE_OPACITY_MIN, 1] 로 자르고 기본(1)은 필드를
 * 지운다. 비유한 값은 무시.
 */
export function withRulerGuideOpacity(
  ruler: SavedRulerInfo,
  opacity: number,
): SavedRulerInfo {
  if (!Number.isFinite(opacity)) return ruler;
  const next = numRound(clampToRange(opacity, RULER_GUIDE_OPACITY_MIN, 1));
  return patchGuide(ruler, (guide) => {
    if ((guide.opacity ?? RULER_GUIDE_OPACITY_DEFAULT) === next) return guide;
    const { opacity: _opacity, ...rest } = guide;
    void _opacity;
    return next === RULER_GUIDE_OPACITY_DEFAULT
      ? rest
      : { ...rest, opacity: next };
  });
}
