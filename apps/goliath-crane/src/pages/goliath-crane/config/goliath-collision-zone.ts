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
 * - 거더는 로컬 X축: rotation Y로 회전한 방향. 다리 중심선의 거더축
 *   오프셋은 GLB 실측값(LEG_OFFSETS)을 쓴다. 주행(레일) 방향은 거더의 수직.
 * - 다리별 radius 60 unit ≈ 70m 라이다 감지, dangerRadius 25.6 ≈ 30m 위험,
 *   cameraRadius 32 ≈ 37m 카메라 근거리 음영 커버.
 * - obstacle: A프레임 하부 풋프린트(주행 방향 약 55m × 횡 17m) 키프아웃.
 * - sizeMultiplier 3: 감지 객체 시각적 과장 배율.
 */
const METERS_PER_UNIT = 1.17;

/**
 * 다리 중심선의 거더축 오프셋 (unit, 크레인 원점 기준 로컬 +X 부호).
 *
 * GLB 지면 접촉 정점(y < 2 unit)을 군집화해 실측한 값이다. 거더 끝단
 * (±65)은 다리 바깥으로 뻗은 오버행이라 스팬 절반 같은 대칭 상수를 쓰면
 * 감지 링 중심이 다리에서 ~10m 벗어나고, 모델 원점도 다리 정중앙이
 * 아니어서(+63.0 / -60.9) 좌우가 미세하게 비대칭이다.
 */
const LEG_OFFSETS = { L1: 63.0, L2: -60.9 } as const;

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
  /**
   * 감지 객체 시각적 과장 배율.
   *
   * 감지 반경 60 unit(≈70m)에 비해 사람 1.75m는 너무 작아 실측 크기로는
   * 화면에서 점이 되므로 과장한다. 다만 6배는 객체가 위험 반경을 가릴
   * 만큼 커져 오히려 공간 관계가 안 읽혔다 — 4배가 "점은 아니되 존을
   * 침범하지 않는" 절충점.
   */
  sizeMultiplier: 4,
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
      center: [cx + gx * LEG_OFFSETS.L1, cz + gz * LEG_OFFSETS.L1],
      travel,
      laneBandsM: L1_LANE_BANDS_M,
      label: 'L1',
    },
    {
      ...LEG_ZONE_BASE,
      center: [cx + gx * LEG_OFFSETS.L2, cz + gz * LEG_OFFSETS.L2],
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
 * 에고 뷰 포즈 — 충돌 감지 진입 시 크레인이 무대의 주인공이 되는 프레이밍.
 *
 * 순수 탑뷰(폴라각 ≈ 0) 대신 기울인 부감으로 잡는다. 직하 뷰는 양쪽
 * 다리를 대칭으로 보여주지만 원근이 없어 모든 것이 납작하고 작아진다 —
 * 사람이 화면에서 점 수준이 되어 FSD처럼 "객체가 주인공"인 화면이 되지
 * 못한다. 기울이면 원근이 생겨 가까운 쪽 객체가 커지고 3D 실루엣도 산다.
 *
 * 구도 산정 (crane-local 기준):
 *  - 거더축(gx, gz) 방향으로는 오프셋 0 — 양쪽 다리 L1(+63)·L2(-60.9)가
 *    좌우 대칭으로 프레임에 들어온다.
 *  - 주행축(travel) 방향으로 뒤로 물러나며 높이를 낮춰 기울기를 만든다.
 *    atan2(BACK, HEIGHT) ≈ 47° 폴라각 — 원근을 충분히 주면서도 양쪽
 *    감지 링(반경 60)이 모두 프레임에 남는 절충점.
 *  - 타깃을 지면보다 살짝 올려(TARGET_HEIGHT) 크레인 상부가 잘리지 않게 한다.
 *
 * 크레인이 레일을 따라 이동해도 같은 상대 구도가 유지된다.
 */
/**
 * 주행축 방향 후퇴 거리 / 카메라 높이 (unit).
 *
 * 크레인이 화면의 주인공이 되도록 바짝 붙인다. 감지 링 양끝
 * (L1 +63 +반경 60 = 123, L2 -60.9 -60 = -121)까지 폭 244 unit이
 * 화면 가로에 담기면 되므로, 시거리 ~130이면 fov 75°·16:9에서
 * 프레임을 가득 채운다. atan2(95, 88) ≈ 47° 부감으로 원근을 준다.
 */
const EGO_BACK = 95;
/** 카메라 높이 (unit) */
const EGO_HEIGHT = 100;
/** 주시점 높이 (unit) — 지면보다 살짝 위 */
const EGO_TARGET_HEIGHT = 12;

export function buildGoliathEgoTopPose(
  cranePosition: Vector3Tuple,
  rotationYDeg = 0,
): CollisionGuardCameraPose {
  const [cx, , cz] = cranePosition;
  const [gx, gz] = girderDir(rotationYDeg);
  // 주행(레일) 방향 — 거더의 수직. 이 축으로 물러나야 거더가 화면
  // 가로로 눕고 양쪽 다리가 좌우에 배치된다.
  const [tx, tz] = [-gz, gx];

  return {
    position: [cx - tx * EGO_BACK, EGO_HEIGHT, cz - tz * EGO_BACK],
    target: [cx, EGO_TARGET_HEIGHT, cz],
  };
}
