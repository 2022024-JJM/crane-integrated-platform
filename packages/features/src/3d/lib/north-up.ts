import {
  headingForAzimuth,
  rotatePoseToHeading,
  type CameraPose,
} from '@crane/core/lib/top-view-pose';

/**
 * "북쪽 위로" — 타깃을 축으로 카메라를 돌려 화면 위가 진북이 되게 한다.
 * 거리·높이·타깃은 그대로다. 탑뷰(직교)는 미세 tilt 방향이 화면 위 방향이라
 * 같은 식으로 평면도가 north-up 이 되고, 원근에서는 시선의 수평 방향이 북을
 * 향한다. 진북 규약은 나침반(lib/compass.ts)과 같다 — 결과 포즈의 나침반
 * northDeg 는 0 이다.
 */
export function northUpPose(
  pose: CameraPose,
  trueNorthDeg: number,
): CameraPose {
  return rotatePoseToHeading(
    pose.position,
    pose.target,
    headingForAzimuth(trueNorthDeg),
  );
}
