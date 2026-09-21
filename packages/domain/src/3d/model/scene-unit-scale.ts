/**
 * 씬 1 unit 이 현실 몇 m 인지 — region 별 표. 씬 배치가 어떤 축척으로 만들어
 * 졌는지에 따라 다르다: 옥포 1dock·2dock 과 필리 두 씬은 지도·모델이 미터
 * 단위(okpo 야드 폭 3344 unit = 3344 m, LNGC 174K 선박 약 300 unit)라
 * 1 m/unit 이고, 지도 없이 모델만 놓인 dock-in 은 모델 스케일·위치가
 * 11.7 m/unit 축소 축척이다.
 *
 * 쓰는 곳: 인스펙터의 영역 반경·오프셋 표시(저장값은 unit 그대로, 화면만 m).
 * 트랜스폼 위치 필드는 아직 unit 그대로 " m" 로 보여 준다 — dock-in 에서 그
 * 값은 미터가 아니므로 같은 환산을 붙이는 것이 다음 단계다. 골리앗 LiDAR 근접 존
 * 설정(goliath-collision-zone.ts 의 METERS_PER_UNIT 1.17)은 센서 보정값이라
 * 이 표와 별개다.
 *
 * 미등록 region 은 1(= unit 이 곧 m).
 */
export const SCENE_METERS_PER_UNIT_BY_REGION_ID: Record<string, number> = {
  'dock-1': 1,
  'dock-2': 1,
  'dock-in': 11.7,
  goliath: 1,
  'philly-dock-2': 1,
};

export function getSceneMetersPerUnit(regionId: string | undefined): number {
  if (!regionId) return 1;
  return SCENE_METERS_PER_UNIT_BY_REGION_ID[regionId] ?? 1;
}
