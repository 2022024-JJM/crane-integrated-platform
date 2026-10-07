import { describe, expect, it } from 'vitest';
import {
  computeTopViewPose,
  type BoundsLike,
} from '@crane/core/lib/top-view-pose';
import {
  CAMERA_GROUND_CLEARANCE,
  CAMERA_MAX_DISTANCE,
  CAMERA_MAX_DISTANCE_RATIO,
  CAMERA_MAX_POLAR_ANGLE,
  CAMERA_MIN_SURFACE_DISTANCE,
  clampToBoundsXZ,
  maxDistanceForBounds,
  maxPolarAngleForMinY,
  surfaceDollyAdvance,
} from '../camera-limits';

/** three Box3.setFromCenterAndSize 와 같은 박스를 three 없이 만든다. */
function box(
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  center: [number, number, number] = [0, 0, 0],
): BoundsLike {
  const [cx, cy, cz] = center;
  return {
    min: { x: cx - sizeX / 2, y: cy - sizeY / 2, z: cz - sizeZ / 2 },
    max: { x: cx + sizeX / 2, y: cy + sizeY / 2, z: cz + sizeZ / 2 },
  };
}

/** three `new Box3()` 기본값 — min=+∞, max=−∞ 라 isEmpty. */
const EMPTY_BOX: BoundsLike = {
  min: { x: Infinity, y: Infinity, z: Infinity },
  max: { x: -Infinity, y: -Infinity, z: -Infinity },
};

describe('maxPolarAngleForMinY', () => {
  it('거리 0·음수·NaN·∞ 는 제한 없음(π)', () => {
    expect(maxPolarAngleForMinY(0, 0, 1)).toBe(Math.PI);
    expect(maxPolarAngleForMinY(0, -5, 1)).toBe(Math.PI);
    expect(maxPolarAngleForMinY(0, NaN, 1)).toBe(Math.PI);
    expect(maxPolarAngleForMinY(0, Infinity, 1)).toBe(Math.PI);
  });

  it('타깃이 반경보다 깊이 지하(cos ≥ 1)면 제한 없음 — 정수직 강제 금지', () => {
    // minY − targetY = distance → cos = 1 (경계 정확값)
    expect(maxPolarAngleForMinY(-10, 11, 1)).toBe(Math.PI);
    // 그보다 더 깊음
    expect(maxPolarAngleForMinY(-100, 11, 1)).toBe(Math.PI);
    // 경계 바로 안쪽은 제한이 걸린다(0 에 가까운 값)
    expect(maxPolarAngleForMinY(-10, 11.001, 1)).toBeLessThan(0.1);
  });

  it('타깃이 충분히 높으면(cos ≤ −1) 제한 없음', () => {
    expect(maxPolarAngleForMinY(11, 10, 1)).toBe(Math.PI);
    expect(maxPolarAngleForMinY(100, 10, 1)).toBe(Math.PI);
    // 경계 바로 안쪽은 π 보다 살짝 작다
    expect(maxPolarAngleForMinY(10.999, 10, 1)).toBeLessThan(Math.PI);
  });

  it('타깃 = minY 이면 수평(π/2)', () => {
    expect(maxPolarAngleForMinY(1, 10, 1)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('(0, 10, 5) → π/3 이고 그 각에서 카메라 y 가 정확히 minY', () => {
    const phi = maxPolarAngleForMinY(0, 10, 5);
    expect(phi).toBeCloseTo(Math.PI / 3, 12);
    expect(0 + 10 * Math.cos(phi)).toBeCloseTo(5, 12);
  });

  it('minY 가 올라갈수록 상한이 단조 감소한다', () => {
    const a = maxPolarAngleForMinY(0, 10, 1);
    const b = maxPolarAngleForMinY(0, 10, 3);
    const c = maxPolarAngleForMinY(0, 10, 6);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('NaN 타깃·minY 는 제한 없음', () => {
    expect(maxPolarAngleForMinY(NaN, 10, 1)).toBe(Math.PI);
    expect(maxPolarAngleForMinY(0, 10, NaN)).toBe(Math.PI);
  });
});

describe('clampToBoundsXZ', () => {
  const b = box(100, 10, 40); // x ∈ [−50, 50], z ∈ [−20, 20]

  it('안에 있으면 델타 0', () => {
    expect(clampToBoundsXZ(0, 0, b)).toEqual({ dx: 0, dz: 0 });
    expect(clampToBoundsXZ(20, -10, b)).toEqual({ dx: 0, dz: 0 });
  });

  it('경계 정확값은 통과, 1 넘으면 되민다', () => {
    expect(clampToBoundsXZ(50, 20, b)).toEqual({ dx: 0, dz: 0 });
    expect(clampToBoundsXZ(-50, -20, b)).toEqual({ dx: 0, dz: 0 });
    expect(clampToBoundsXZ(51, 0, b)).toEqual({ dx: -1, dz: 0 });
    expect(clampToBoundsXZ(0, -21, b)).toEqual({ dx: 0, dz: 1 });
  });

  it('모서리 밖이면 두 축을 함께 되민다', () => {
    expect(clampToBoundsXZ(70, 35, b)).toEqual({ dx: -20, dz: -15 });
  });

  it('한 축만 벗어나면 그 축만 움직인다', () => {
    expect(clampToBoundsXZ(70, 0, b)).toEqual({ dx: -20, dz: 0 });
    expect(clampToBoundsXZ(0, 35, b)).toEqual({ dx: 0, dz: -15 });
  });

  it('y 는 보지 않는다 — XZ 전용', () => {
    const tall = box(100, 1000, 40);
    expect(clampToBoundsXZ(70, 0, tall)).toEqual({ dx: -20, dz: 0 });
  });

  it('원점이 아닌 박스도 같은 규칙', () => {
    const off = box(100, 10, 40, [500, 0, -300]); // x ∈ [450,550], z ∈ [−320,−280]
    expect(clampToBoundsXZ(500, -300, off)).toEqual({ dx: 0, dz: 0 });
    expect(clampToBoundsXZ(440, -270, off)).toEqual({ dx: 10, dz: -10 });
  });

  it('크기 0 박스는 그 한 점으로 모은다', () => {
    const point = box(0, 0, 0, [7, 0, -3]);
    expect(clampToBoundsXZ(10, 0, point)).toEqual({ dx: -3, dz: -3 });
  });

  it('델타를 더한 점은 다시 넣어도 델타 0(멱등)', () => {
    const d = clampToBoundsXZ(70, -35, b)!;
    expect(clampToBoundsXZ(70 + d.dx, -35 + d.dz, b)).toEqual({
      dx: 0,
      dz: 0,
    });
  });

  it('빈 박스·NaN 입력은 null(이동 없음)', () => {
    expect(clampToBoundsXZ(0, 0, EMPTY_BOX)).toBeNull();
    expect(clampToBoundsXZ(NaN, 0, b)).toBeNull();
    expect(clampToBoundsXZ(0, NaN, b)).toBeNull();
  });
});

describe('maxDistanceForBounds', () => {
  const FOV = 60;

  it('bounds 없음·빈 박스는 상한값', () => {
    expect(maxDistanceForBounds(null, 1, FOV)).toBe(CAMERA_MAX_DISTANCE);
    expect(maxDistanceForBounds(EMPTY_BOX, 1, FOV)).toBe(CAMERA_MAX_DISTANCE);
  });

  it('작은 지도는 탑뷰 fit 거리 × 배수', () => {
    const b = box(100, 10, 100);
    const pose = computeTopViewPose(b, 1, FOV)!;
    const dx = pose.position[0] - pose.target[0];
    const dy = pose.position[1] - pose.target[1];
    const dz = pose.position[2] - pose.target[2];
    const fit = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const max = maxDistanceForBounds(b, 1, FOV);
    expect(max).toBeCloseTo(fit * CAMERA_MAX_DISTANCE_RATIO, 9);
    expect(max).toBeLessThan(CAMERA_MAX_DISTANCE);
  });

  it('거대 지도는 상한에 잘린다 — fit × 1.0 이 상한을 넘는 크기', () => {
    expect(maxDistanceForBounds(box(200_000, 10, 200_000), 1, FOV)).toBe(
      CAMERA_MAX_DISTANCE,
    );
  });

  it('가로로 넓은 지도는 aspect 가 작을수록 상한이 커진다', () => {
    const b = box(400, 10, 100);
    expect(maxDistanceForBounds(b, 0.5, FOV)).toBeGreaterThan(
      maxDistanceForBounds(b, 2, FOV),
    );
  });

  it('aspect NaN·0 도 유한한 값', () => {
    const b = box(100, 10, 100);
    expect(Number.isFinite(maxDistanceForBounds(b, NaN, FOV))).toBe(true);
    expect(Number.isFinite(maxDistanceForBounds(b, 0, FOV))).toBe(true);
    expect(maxDistanceForBounds(b, NaN, FOV)).toBe(
      maxDistanceForBounds(b, 1, FOV),
    );
  });
});

describe('CAMERA_GROUND_CLEARANCE', () => {
  it('양수·유한 — 바다 평면 아래로 내려가지 않는다', () => {
    expect(CAMERA_GROUND_CLEARANCE).toBeGreaterThan(0);
    expect(Number.isFinite(CAMERA_GROUND_CLEARANCE)).toBe(true);
  });

  it('지면에 선 사람 키(약 1.8m)보다 낮아 눈높이 시점이 가능하다', () => {
    expect(CAMERA_GROUND_CLEARANCE).toBeLessThan(1.8);
  });
});

describe('CAMERA_MIN_SURFACE_DISTANCE', () => {
  it('양수이고 최대 거리 상한보다 작다', () => {
    expect(CAMERA_MIN_SURFACE_DISTANCE).toBeGreaterThan(0);
    expect(CAMERA_MIN_SURFACE_DISTANCE).toBeLessThan(CAMERA_MAX_DISTANCE);
  });

  it('최대 기울기에서 지면 피벗에 다가갈 수 있는 최소 반경 = 바닥 여유 / cos(극각 상한) — 특성화', () => {
    // 바닥 여유·극각 상한은 확대 하한과 별개로 걸린다. 지면(y=0) 위 피벗을
    // 극각 상한 그대로 보면 카메라 y 가 바닥 여유에 닿는 반경이 이 값이고,
    // 그보다 가까우면 동적 상한이 극각을 더 세운다.
    const r = CAMERA_GROUND_CLEARANCE / Math.cos(CAMERA_MAX_POLAR_ANGLE);
    expect(maxPolarAngleForMinY(0, r, CAMERA_GROUND_CLEARANCE)).toBeCloseTo(
      CAMERA_MAX_POLAR_ANGLE,
      12,
    );
    expect(
      maxPolarAngleForMinY(0, r / 2, CAMERA_GROUND_CLEARANCE),
    ).toBeLessThan(CAMERA_MAX_POLAR_ANGLE);
    // 확대 하한보다 훨씬 멀다 — 비스듬히 볼수록 지면 위 객체에서 멀리 멈춘다.
    expect(r).toBeGreaterThan(CAMERA_MIN_SURFACE_DISTANCE);
  });
});

describe('surfaceDollyAdvance', () => {
  const MIN = CAMERA_MIN_SURFACE_DISTANCE;
  const MAX = 1000;

  it('줌인: 유효 거리 × (1 − 배율) 만큼 표면 쪽(+)', () => {
    expect(surfaceDollyAdvance(100, 0, 0.9, MAX)).toBeCloseTo(10, 12);
  });

  it('줌아웃: 음수(표면 반대쪽)', () => {
    expect(surfaceDollyAdvance(100, 0, 1.25, MAX)).toBeCloseTo(-25, 12);
  });

  it('pending 을 뺀 유효 거리에서 비율을 잡는다 — 연속 휠에서 틱당 비율 동일', () => {
    // 100 에서 10 줌인(pending 10) 뒤 한 번 더: 90 × 0.1 = 9
    const first = surfaceDollyAdvance(100, 0, 0.9, MAX);
    expect(surfaceDollyAdvance(100, first, 0.9, MAX)).toBeCloseTo(9, 12);
  });

  it('하한 정확값에서 줌인은 0(멈춤), 하한 바로 위에서는 하한까지만', () => {
    expect(surfaceDollyAdvance(MIN, 0, 0.5, MAX)).toBe(0);
    expect(surfaceDollyAdvance(MIN + 1, 0, 0.5, MAX)).toBe(1);
  });

  it('하한보다 가까이 있으면(모델 안) 줌인 0, 줌아웃은 하한 기준', () => {
    expect(surfaceDollyAdvance(MIN / 2, 0, 0.9, MAX)).toBe(0);
    // 유효 거리 = 하한 → 하한 × 2 까지 물러난다
    expect(surfaceDollyAdvance(MIN / 2, 0, 2, MAX)).toBeCloseTo(-MIN, 12);
  });

  it('pending 이 거리를 넘어서면 유효 거리는 하한 — 줌인 0', () => {
    expect(surfaceDollyAdvance(100, 200, 0.9, MAX)).toBe(0);
  });

  it('상한 정확값에서 줌아웃은 0, 상한 바로 아래에서는 상한까지만', () => {
    expect(surfaceDollyAdvance(MAX, 0, 2, MAX)).toBe(0);
    expect(surfaceDollyAdvance(MAX - 1, 0, 2, MAX)).toBe(-1);
  });

  it('상한이 하한보다 작으면 하한을 상한으로 쓴다 — 줌아웃도 하한으로 모인다(특성화)', () => {
    // 지도 탑뷰 fit 거리가 상한이라 실제로는 닿지 않는 조합이다. 옛 휠
    // 핸들러의 clamp 결과를 그대로 고정한다.
    expect(surfaceDollyAdvance(100, 0, 2, MIN / 2)).toBe(100 - MIN);
  });

  it('상한이 유한하지 않으면 CAMERA_MAX_DISTANCE', () => {
    expect(surfaceDollyAdvance(CAMERA_MAX_DISTANCE, 0, 2, Infinity)).toBe(0);
    expect(surfaceDollyAdvance(CAMERA_MAX_DISTANCE, 0, 2, NaN)).toBe(0);
    expect(surfaceDollyAdvance(100, 0, 2, Infinity)).toBeCloseTo(-100, 12);
  });

  it('거리·pending·배율이 유한하지 않으면 0(이동 없음)', () => {
    expect(surfaceDollyAdvance(NaN, 0, 0.9, MAX)).toBe(0);
    expect(surfaceDollyAdvance(Infinity, 0, 0.9, MAX)).toBe(0);
    expect(surfaceDollyAdvance(100, NaN, 0.9, MAX)).toBe(0);
    expect(surfaceDollyAdvance(100, 0, NaN, MAX)).toBe(0);
  });

  it('배율 1 은 어디서든 0', () => {
    expect(surfaceDollyAdvance(100, 0, 1, MAX)).toBe(0);
    expect(surfaceDollyAdvance(MIN, 0, 1, MAX)).toBe(0);
    expect(surfaceDollyAdvance(MAX, 0, 1, MAX)).toBe(0);
  });
});
