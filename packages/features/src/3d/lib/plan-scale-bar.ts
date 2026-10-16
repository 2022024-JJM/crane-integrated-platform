/**
 * 평면도(직교 탑뷰) 축척 바 — 직교 카메라는 화면 어디서나 m 당 px 가 같아
 * 축척 하나로 거리를 읽을 수 있다. 바 길이는 상한 px 안에서 가장 긴
 * 1·2·5×10ⁿ m 로 고른다. 그리기는 ui/scene-plan-scale-bar.tsx 가 DOM 에
 * 직접 쓴다(나침반과 같은 매-프레임 갱신 규칙).
 */

/** 바의 최대 화면 길이(px). 나침반과 같은 좌상단 열에 놓이는 폭. */
export const PLAN_SCALE_BAR_MAX_PX = 140;

const NICE_STEPS = [1, 2, 5] as const;

export interface PlanScaleBar {
  /** 바가 나타내는 실제 길이(m). */
  meters: number;
  /** 바의 화면 길이(px). */
  px: number;
  /** 표시 문구("50 m", "1 km"). */
  label: string;
}

/**
 * 직교 카메라의 씬 단위당 화면 px — zoom × 캔버스 높이 / 프러스텀 높이.
 * 비유한수·0 이하 입력은 NaN.
 */
export function orthoPixelsPerUnit(
  zoom: number,
  top: number,
  bottom: number,
  heightPx: number,
): number {
  const span = top - bottom;
  if (
    !Number.isFinite(zoom) ||
    !Number.isFinite(span) ||
    !Number.isFinite(heightPx) ||
    zoom <= 0 ||
    span <= 0 ||
    heightPx <= 0
  ) {
    return Number.NaN;
  }
  return (zoom * heightPx) / span;
}

function trimNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/** m 를 사람이 읽는 길이로 — 1000 이상은 km, 1 미만은 cm. */
export function formatPlanScale(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '';
  if (meters >= 1000) return `${trimNumber(meters / 1000)} km`;
  if (meters < 1) return `${trimNumber(meters * 100)} cm`;
  return `${trimNumber(meters)} m`;
}

/**
 * m 당 px 에서 바를 고른다 — maxPx 이하에서 가장 긴 1·2·5×10ⁿ m. 결과 px 는
 * maxPx 의 2/5 이상이라 바가 너무 짧아지지 않는다. 축척을 알 수 없으면 null.
 */
export function resolvePlanScaleBar(
  pxPerMeter: number,
  maxPx: number = PLAN_SCALE_BAR_MAX_PX,
): PlanScaleBar | null {
  if (!Number.isFinite(pxPerMeter) || pxPerMeter <= 0) return null;
  if (!Number.isFinite(maxPx) || maxPx <= 0) return null;
  const maxMeters = maxPx / pxPerMeter;
  if (!Number.isFinite(maxMeters) || maxMeters <= 0) return null;
  const exponent = Math.floor(Math.log10(maxMeters));
  let best = 0;
  for (const e of [exponent - 1, exponent, exponent + 1]) {
    for (const step of NICE_STEPS) {
      const meters = step * 10 ** e;
      if (meters <= maxMeters && meters > best) best = meters;
    }
  }
  if (best <= 0) return null;
  return { meters: best, px: best * pxPerMeter, label: formatPlanScale(best) };
}
