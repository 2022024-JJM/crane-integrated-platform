import { Quaternion, Vector3 } from 'three';
import type { Vector3Tuple } from '@crane/core/types/math';

// 매 프레임(liveSync) 호출되므로 스크래치 하나를 재사용해 할당을 피한다.
const scratch = new Vector3();

/**
 * 피벗을 중심으로 회전 델타만큼 궤도 이동한 위치 — `pivot + Δq·(p0 − pivot)`.
 *
 * 다중 선택 변형 피벗이 "기준 원점"(primary)일 때 세컨더리에 쓴다: 프라이머리는
 * TransformControls 가 제자리에서 돌리고, 세컨더리는 자세에 같은 Δq 를 곱한
 * 뒤 이 위치로 옮기면 선택 전체가 강체처럼 돈다. 입력 튜플은 바꾸지 않고
 * 반올림도 하지 않는다(커밋 경로가 한다).
 */
export function orbitAroundPivot(
  startPosition: Vector3Tuple,
  pivot: Vector3Tuple,
  delta: Quaternion,
): Vector3Tuple {
  scratch
    .set(
      startPosition[0] - pivot[0],
      startPosition[1] - pivot[1],
      startPosition[2] - pivot[2],
    )
    .applyQuaternion(delta);
  return [scratch.x + pivot[0], scratch.y + pivot[1], scratch.z + pivot[2]];
}

/**
 * 피벗을 중심으로 성분별 비율만큼 벌린 위치 — `pivot + (p0 − pivot) ⊙ ratio`.
 * 크기 모드의 세컨더리용. 비율은 프라이머리의 시작 대비 현재 배율이다.
 */
export function scaleAboutPivot(
  startPosition: Vector3Tuple,
  pivot: Vector3Tuple,
  ratio: Vector3Tuple,
): Vector3Tuple {
  return [
    pivot[0] + (startPosition[0] - pivot[0]) * ratio[0],
    pivot[1] + (startPosition[1] - pivot[1]) * ratio[1],
    pivot[2] + (startPosition[2] - pivot[2]) * ratio[2],
  ];
}
