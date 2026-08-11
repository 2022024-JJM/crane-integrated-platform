import type { Vector3Tuple } from '@crane/core/types/math';
import type {
  CollisionGuardCameraPose,
  CollisionGuardZone,
} from '@crane/features/3d';

/**
 * 골리앗 크레인 충돌 감지 존 빌더 — 라이다는 거더 양쪽 다리에 1기씩.
 *
 * 크레인은 레일을 따라 계속 이동하므로 존 좌표를 하드코딩하지 않고,
 * 씬의 크레인 모델 배치(position/rotation)로부터 매번 파생한다.
 * 크레인이 움직이면 감지 존·FSD 카메라도 함께 따라온다.
 *
 * - 씬 축척: 크레인 GLB 네이티브 스팬 141 unit = 실측 165m → 1 unit ≈ 1.17m.
 * - 거더는 로컬 X축: rotation Y로 회전한 방향. SPAN 절반 70.5 unit을
 *   거더 방향으로 이동한 지점이 양쪽 다리다. 주행(레일) 방향은 거더의 수직.
 * - 다리별 radius 60 unit ≈ 70m 라이다 감지, dangerRadius 25.6 ≈ 30m 위험,
 *   cameraRadius 32 ≈ 37m 카메라 근거리 음영 커버.
 * - obstacle: A프레임 하부 풋프린트(주행 방향 약 55m × 횡 17m) 키프아웃.
 * - sizeMultiplier 3: 감지 객체 시각적 과장 배율.
 */
const METERS_PER_UNIT = 1.17;

/** SPAN 165m의 절반 (unit) */
const LEG_HALF_SPAN = 70.5;

/**
 * 통행 가능 차선 밴드 (m, travel 축 기준 횡 오프셋 — 양수 = 거더 +방향의
 * 왼쪽). 필리 지형 실측(탑뷰): 크레인 도크는 L2 쪽에 인접하고 L1 바깥에는
 * 창고 군락이 있다. 실제로 다닐 수 있는 곳은 다리 옆 레일 주행로 부지뿐이라
 * 밴드를 좁게 잡는다 — 크레인이 "레일을 따라" 움직이는 한 횡방향 지형은
 * 변하지 않으므로 이 밴드는 크레인 위치와 무관하게 유효하다.
 */
const L1_LANE_BANDS_M: Array<[number, number]> = [
  [13, 40], // 크레인 도크 쪽: 도크 가장자리 전 열린 부지
  [-20, -13], // 바깥쪽: 창고 군락 전 레일 주행로
];
const L2_LANE_BANDS_M: Array<[number, number]> = [
  [13, 22], // 인접 도크 전 레일 부지 (반대쪽은 바로 크레인 도크라 통행 불가)
];

const LEG_ZONE_BASE = {
  y: 0.05,
  radius: 60,
  dangerRadius: 25.6,
  // 위험 반경과 겹치면 링이 포개져 보이므로 한 단계 바깥에 둔다.
  cameraRadius: 32,
  obstacle: { halfAlong: 26, halfAcross: 7.5 },
  metersPerUnit: METERS_PER_UNIT,
  sizeMultiplier: 3,
} satisfies Omit<CollisionGuardZone, 'center' | 'label' | 'travel'>;

/** rotation Y(도)로부터 거더 방향 단위 벡터 (로컬 +X의 월드 사영) */
function girderDir(rotationYDeg: number): [number, number] {
  const rad = (rotationYDeg * Math.PI) / 180;
  return [Math.cos(rad), -Math.sin(rad)];
}

export function buildGoliathCollisionZones(
  cranePosition: Vector3Tuple,
  rotationYDeg: number,
): CollisionGuardZone[] {
  const [cx, , cz] = cranePosition;
  const [gx, gz] = girderDir(rotationYDeg);
  // 주행(레일) 방향 — 거더의 수직.
  const travel: [number, number] = [-gz, gx];

  return [
    {
      ...LEG_ZONE_BASE,
      center: [cx + gx * LEG_HALF_SPAN, cz + gz * LEG_HALF_SPAN],
      travel,
      laneBandsM: L1_LANE_BANDS_M,
      label: 'L1',
    },
    {
      ...LEG_ZONE_BASE,
      center: [cx - gx * LEG_HALF_SPAN, cz - gz * LEG_HALF_SPAN],
      travel,
      laneBandsM: L2_LANE_BANDS_M,
      label: 'L2',
    },
  ];
}

/**
 * FSD 모드 카메라 포즈 — 크레인 중심 기준 상대 오프셋으로 파생한다.
 * 남동측(저작 기본 카메라와 같은 방위)에서 내려다보는 시네마틱 구도로,
 * 양쪽 다리 존이 모두 화면에 들어온다. 크레인이 이동해도 같은 상대
 * 구도가 유지된다.
 */
const FSD_CAMERA_POSITION_OFFSET: Vector3Tuple = [85.4, 120, 287.8];
const FSD_CAMERA_TARGET_HEIGHT = 45;

export function buildGoliathFsdCamera(
  cranePosition: Vector3Tuple,
): CollisionGuardCameraPose {
  const [cx, , cz] = cranePosition;
  return {
    position: [
      cx + FSD_CAMERA_POSITION_OFFSET[0],
      FSD_CAMERA_POSITION_OFFSET[1],
      cz + FSD_CAMERA_POSITION_OFFSET[2],
    ],
    target: [cx, FSD_CAMERA_TARGET_HEIGHT, cz],
  };
}

/**
 * 에고 탑뷰 포즈 — 탑뷰 진입 시 크레인이 무대의 주인공이 되도록
 * 크레인 바로 위에서 내려다보는 프레이밍 (테슬라의 ego 중심 원리).
 *
 * 높이 산정: 거더 스팬 141 + 양쪽 링 지름(2×60) ≈ 261 unit 폭이
 * 화면에 들어와야 한다. fov 75°·가로 화면 기준 h ≈ 130이면 여유 포함
 * 프레임의 ~75%를 채운다. z에 미세 오프셋을 두어 폴라각 0의 짐벌
 * 특이점을 피한다.
 */
const EGO_TOP_HEIGHT = 130;

export function buildGoliathEgoTopPose(
  cranePosition: Vector3Tuple,
): CollisionGuardCameraPose {
  const [cx, , cz] = cranePosition;
  return {
    position: [cx, EGO_TOP_HEIGHT, cz + 0.5],
    target: [cx, 0, cz],
  };
}
