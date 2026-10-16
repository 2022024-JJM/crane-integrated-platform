/**
 * 평면도 룩 판정 — "활성 카메라가 직교이고 평면도 룩 스위치가 켜져 있다".
 * 탑뷰 관련 처리(그림자·바닥 톤·투광등·윤곽·라벨 앵커·겹침 검출)가 전부 이
 * 하나를 본다. 스위치는 model/use-plan-look-store.ts, 2D/3D 탑뷰 버튼이 바꾼다.
 */
export function isPlanLookCamera(camera: object, enabled: boolean): boolean {
  return (
    enabled &&
    (camera as { isOrthographicCamera?: boolean }).isOrthographicCamera === true
  );
}
