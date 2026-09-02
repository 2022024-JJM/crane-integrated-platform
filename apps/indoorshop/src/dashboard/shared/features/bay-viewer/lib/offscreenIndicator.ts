/*
 * 화면 밖 이상 정반의 방향 표식 (PRD FR-9).
 *
 * 카메라를 당겨 이상 정반이 시야 밖으로 나가면, 가장 가까운 화면 가장자리에
 * 방향 화살표를 세워 "화면 밖에 문제가 있다"는 사실이 사라지지 않게 한다.
 * 3D 투영(NDC)까지는 뷰어가 하고, 여기는 **가장자리 배치와 각도만** 계산하는
 * 순수 함수다 — 단위 테스트 대상.
 */

export interface EdgePlacement {
  /** 뷰포트 좌상단 기준 px */
  x: number
  y: number
  /** 화살표 회전각(도) — 0 = 오른쪽, 90 = 아래 (CSS rotate 기준) */
  angleDeg: number
}

/**
 * NDC(-1..1) 좌표 → 화면 가장자리 배치.
 *
 * - 대상이 뷰포트 안에 보이면 null (표식이 필요 없다).
 * - `behindCamera` 면 투영 좌표가 뒤집혀 있으므로 방향을 반대로 세운다.
 * - 배치점은 화면 중심에서 대상 방향으로 나가다 여백(margin) 안쪽 사각형에
 *   부딪히는 지점 — 항상 "가장 가까운 가장자리"가 된다.
 */
export function edgePlacementFor(
  ndcX: number,
  ndcY: number,
  behindCamera: boolean,
  width: number,
  height: number,
  margin: number
): EdgePlacement | null {
  if (width <= 0 || height <= 0) return null

  // NDC → 화면 px (y 는 아래로 증가)
  const sx = ((ndcX + 1) / 2) * width
  const sy = ((1 - ndcY) / 2) * height

  const inView =
    !behindCamera && sx >= margin && sx <= width - margin && sy >= margin && sy <= height - margin
  if (inView) return null

  const cx = width / 2
  const cy = height / 2
  let dx = sx - cx
  let dy = sy - cy
  if (behindCamera) {
    // 카메라 뒤 대상은 투영이 반대편에 찍힌다 — 방향을 되집는다
    dx = -dx
    dy = -dy
  }
  if (dx === 0 && dy === 0) dy = 1 // 정확히 중심 뒤 — 임의로 아래쪽

  // 중심에서 (dx,dy) 방향으로 나가 여백 사각형 경계에 닿는 배율
  const limitX = dx === 0 ? Infinity : (cx - margin) / Math.abs(dx)
  const limitY = dy === 0 ? Infinity : (cy - margin) / Math.abs(dy)
  const t = Math.min(limitX, limitY)

  return {
    x: cx + dx * t,
    y: cy + dy * t,
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}
