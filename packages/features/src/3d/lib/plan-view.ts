import type { Vector3Tuple } from '@crane/core/types/math';
import {
  TOP_VIEW_PLAN_MIN_DOWN,
  isPlanDirection,
} from '@crane/core/lib/top-view-pose';

/**
 * 평면(탑뷰) 관제 — 순수 판정. 카메라가 충분히 내려다보면 장비를 모델이
 * 아니라 화면 고정 크기의 기호(점 + id 칩)로 읽게 한다(ui/scene-plan-markers).
 * 항공·VTS·타워크레인 충돌방지 화면이 쓰는 표현이다 — 2 km 위에서 실사
 * 모델은 몇 픽셀이라 정보가 없다.
 */

/** 시선의 -Y 성분 하한 — 뷰어(탑뷰 fov 복원)와 같은 문턱(core). */
export const PLAN_VIEW_MIN_DOWN = TOP_VIEW_PLAN_MIN_DOWN;

export function isPlanView(directionY: number): boolean {
  return isPlanDirection(directionY);
}

/**
 * 탑뷰의 수직 fov(도) — 좁게(망원) 보아 원근 왜곡을 줄인다. 건물 옆면이
 * 안 보이고 크레인이 기울지 않아 평면도에 가깝다. 같은 범위를 fov 배율만큼
 * 멀리서 보므로 안개는 카메라 높이를 따른다(lib/control-room-fog).
 */
export const PLAN_VIEW_FOV = 18;
/** 구역 탑뷰의 거리 배율 — 보던 구역을 주변까지 여유 있게 담는다. */
export const PLAN_VIEW_DISTANCE_SCALE = 1.8;

/** 화면 세로에 보이는 실거리(m) — 높이·fov 로. */
export function visibleExtentM(
  cameraHeightUnits: number,
  fovDeg: number,
  metersPerUnit: number,
): number {
  const mpu = metersPerUnit > 0 ? metersPerUnit : 1;
  return 2 * cameraHeightUnits * Math.tan((fovDeg * Math.PI) / 360) * mpu;
}

/** 겹침 정리 주기(ms) — 매 프레임 레이아웃을 읽지 않는다. */
export const PLAN_STACK_INTERVAL_MS = 250;
/** 칩 사이 세로 간격(px). */
export const PLAN_STACK_GAP_PX = 2;

export interface MarkerBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 겹친 칩 밀어내기 — 화면 y, x 순으로 보며 앞서 놓인 것과 겹치면 그 아래로
 * 내린다(greedy). 반환은 입력 순서대로의 y 오프셋. 원래 자리에서 멀어진
 * 칩은 점과 선이 아니라 자리만 내려가므로 점(장비 위치)은 그대로다.
 */
export function stackMarkerRows(boxes: readonly MarkerBox[]): number[] {
  const order = boxes
    .map((b, i) => ({ b, i }))
    .sort((p, q) => p.b.y - q.b.y || p.b.x - q.b.x);
  const placed: MarkerBox[] = [];
  const offsets = new Array<number>(boxes.length).fill(0);
  for (const { b, i } of order) {
    let y = b.y;
    let moved = true;
    while (moved) {
      moved = false;
      for (const p of placed) {
        const overlapX = Math.abs(p.x - b.x) < (p.w + b.w) / 2;
        const overlapY = Math.abs(p.y - y) < (p.h + b.h) / 2;
        if (overlapX && overlapY) {
          y = p.y + (p.h + b.h) / 2 + PLAN_STACK_GAP_PX;
          moved = true;
        }
      }
    }
    placed.push({ x: b.x, y, w: b.w, h: b.h });
    offsets[i] = y - b.y;
  }
  return offsets;
}

/** 마커를 눌렀을 때 내려가는 비스듬한 포즈 — 장비 중심을 타깃으로 남동쪽 위. */
export const PLAN_FOCUS_DISTANCE_M = 140;

export function equipmentFocusPose(
  center: Vector3Tuple,
  metersPerUnit: number,
): { position: Vector3Tuple; target: Vector3Tuple } {
  const mpu = metersPerUnit > 0 ? metersPerUnit : 1;
  const d = PLAN_FOCUS_DISTANCE_M / mpu;
  const n = Math.sqrt(0.5 * 0.5 + 0.75 * 0.75 + 0.5 * 0.5);
  return {
    position: [
      center[0] + (0.5 / n) * d,
      center[1] + (0.75 / n) * d,
      center[2] + (0.5 / n) * d,
    ],
    target: center,
  };
}

/** 작업 범위 표시(scene-equipment-footprints)의 재측정 주기·갠트리 틀 두께. */
export const PLAN_SYMBOL_UPDATE_MS = 250;
/** 평면 모드에서 환경(바탕)을 어둡히는 배율 — 관제 모드만. */
export const PLAN_ENV_DIM = 0.45;
/** 화면 세로 실거리(m)가 이보다 크면 평상시 장비의 이름 칩을 숨기고 점만 둔다(호버·근접은 보인다). */
export const PLAN_LABEL_MAX_EXTENT_M = 900;

export function isPlanLabelVisible(extentM: number): boolean {
  return Number.isFinite(extentM) && extentM <= PLAN_LABEL_MAX_EXTENT_M;
}
/** 선회하지 않는 장비(갠트리)의 사각 틀 두께 — 짧은 변 대비. */
export const PLAN_FRAME_WIDTH_RATIO = 0.12;
/** 지브 판정 — AABB 중심이 마스트에서 반지름의 이 비율 넘게 치우치면 선회 장비. */
export const PLAN_HEADING_MIN_RATIO = 0.15;
/** 칩과 원 가장자리 사이(px). */
export const PLAN_LABEL_GAP_PX = 6;

/**
 * 지브 방향(라디안, XZ 평면 atan2(dz, dx)) — 선회 장비 판정에 쓴다. 평면
 * AABB 중심이 마스트(루트)에서 치우친 쪽이 지브다(지브가 카운터지브보다
 * 길어서 안정적). 갠트리처럼 대칭이면 null.
 */
export function planHeading(
  rootX: number,
  rootZ: number,
  centerX: number,
  centerZ: number,
  radius: number,
): number | null {
  const dx = centerX - rootX;
  const dz = centerZ - rootZ;
  const r = Math.max(radius, 1e-6);
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return null;
  if (Math.hypot(dx, dz) < r * PLAN_HEADING_MIN_RATIO) return null;
  return Math.atan2(dz, dx);
}
