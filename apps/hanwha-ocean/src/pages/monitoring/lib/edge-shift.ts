/**
 * 지도 가장자리 마커의 플레이트를 지도 안쪽으로 밀어 넣는 계산.
 *
 * 마커 플레이트는 좌표점을 가운데 두고 좌우로 뻗으므로, 동쪽 끝(한화오션)이나
 * 서쪽 끝에 있는 마커는 절반이 지도 밖으로 잘린다. 카메라를 건드려 여백을
 * 만드는 방법은 `restriction.strictBounds` 가 세계 경계를 화면에 꽉 채우도록
 * 강제하고 있어 쓸 수 없다 — 그래서 좌표점은 그대로 두고 **플레이트만**
 * 안쪽으로 민다.
 *
 * 플레이트가 반 너비 이상 밀리면 세로 스템이 플레이트 밑변에서 벗어나므로,
 * 그만큼을 가로 리더(elbow)로 이어 준다. 지도 콜아웃의 표준 처리다.
 *
 * `ui/*.tsx` 안에서 수치 계산을 하지 않는다는 규약에 따라 순수 함수로 분리한다.
 */
export interface EdgeShiftInput {
  /** 밀기 전 플레이트의 왼쪽 x (뷰포트 좌표) */
  plateLeft: number;
  plateWidth: number;
  /** 지도 영역의 좌/우 x (뷰포트 좌표) */
  boundsLeft: number;
  boundsRight: number;
  /** 지도 가장자리에서 최소로 띄울 여백 */
  pad: number;
  /** 가로 리더가 플레이트 밑변 아래로 파고들 길이 — 이음매를 감춘다 */
  stemInset: number;
}

export interface EdgeShift {
  /** 플레이트에 걸 가로 이동량(px). 좌표점은 움직이지 않는다 */
  shiftX: number;
  /** 세로 스템과 밀린 플레이트를 잇는 가로 리더 길이(px). 0 이면 그리지 않는다 */
  leaderWidth: number;
  /** 가로 리더의 시작 x 오프셋(px). 좌표점 기준 */
  leaderOffset: number;
}

const NO_SHIFT: EdgeShift = { shiftX: 0, leaderWidth: 0, leaderOffset: 0 };

export function computeEdgeShift({
  plateLeft,
  plateWidth,
  boundsLeft,
  boundsRight,
  pad,
  stemInset,
}: EdgeShiftInput): EdgeShift {
  if (
    !Number.isFinite(plateLeft) ||
    !Number.isFinite(plateWidth) ||
    plateWidth <= 0 ||
    boundsRight <= boundsLeft
  ) {
    return NO_SHIFT;
  }

  const minLeft = boundsLeft + pad;
  // 플레이트가 지도보다 넓으면 오른쪽 한계가 왼쪽 한계보다 앞서게 되므로,
  // 그때는 왼쪽 정렬로 떨어뜨린다(잘리더라도 앞부분은 읽힌다).
  const maxLeft = Math.max(minLeft, boundsRight - pad - plateWidth);
  const shiftX = clamp(plateLeft, minLeft, maxLeft) - plateLeft;

  if (shiftX === 0) return NO_SHIFT;

  // 반 너비까지는 스템이 아직 플레이트 밑변에 닿아 있어 리더가 필요 없다.
  const overhang = Math.abs(shiftX) - plateWidth / 2 + stemInset;
  if (overhang <= 0) return { shiftX, leaderWidth: 0, leaderOffset: 0 };

  return {
    shiftX,
    leaderWidth: overhang,
    leaderOffset: shiftX < 0 ? -overhang : 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
