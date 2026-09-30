import { describe, expect, it } from 'vitest';
import {
  COMPASS_LABEL_OFFSET_PX,
  COMPASS_POINTS,
  COMPASS_RING_RADIUS_PX,
  COMPASS_SIZE_PX,
  compassLabelPosition,
  compassPlaneMatrix,
  resolveCompassView,
  type CompassVec3,
  type CompassView,
} from '../compass';

const DEG2RAD = Math.PI / 180;

function vec(x: number, y: number, z: number): CompassVec3 {
  return { x, y, z };
}

/**
 * 카메라 up=+Y(roll 없음)에서 월드 방위 yawDeg(−Z 기준 시계 방향)를 바라보며
 * pitchDeg 만큼 내려다보는 카메라의 전방·위 벡터.
 */
function cameraBasis(
  yawDeg: number,
  pitchDeg: number,
): { forward: CompassVec3; up: CompassVec3 } {
  const yaw = yawDeg * DEG2RAD;
  const pitch = pitchDeg * DEG2RAD;
  const hx = Math.sin(yaw);
  const hz = -Math.cos(yaw);
  return {
    forward: vec(hx * Math.cos(pitch), -Math.sin(pitch), hz * Math.cos(pitch)),
    up: vec(hx * Math.sin(pitch), Math.cos(pitch), hz * Math.sin(pitch)),
  };
}

function viewOf(yawDeg: number, pitchDeg: number, trueNorth: number) {
  const { forward, up } = cameraBasis(yawDeg, pitchDeg);
  return resolveCompassView(forward, up, trueNorth);
}

/** 평면 행렬로 지면 점을 화면에 옮긴다. */
function applyPlane(view: CompassView, x: number, y: number) {
  const [a, b, c, d] = compassPlaneMatrix(view);
  return { x: a * x + c * y, y: b * x + d * y };
}

describe('resolveCompassView — 북쪽 각도', () => {
  it('−Z 를 바라보면(진북 0) 북이 화면 위쪽이다', () => {
    expect(viewOf(0, 45, 0)!.northDeg).toBeCloseTo(0, 10);
  });

  it('+X 를 바라보면 북은 왼쪽(270°), −X 를 바라보면 오른쪽(90°)', () => {
    expect(viewOf(90, 45, 0)!.northDeg).toBeCloseTo(270, 10);
    expect(viewOf(270, 45, 0)!.northDeg).toBeCloseTo(90, 10);
  });

  it('+Z 를 바라보면 북은 화면 아래쪽(180°)', () => {
    expect(viewOf(180, 30, 0)!.northDeg).toBeCloseTo(180, 10);
  });

  it('진북만큼 시계 방향으로 돈다 — 옥포 탑뷰(화면 위 = −Z)에서 N 은 오른쪽 위', () => {
    // 탑뷰는 ensureTopViewTilt 의 미세 tilt 로 −Z 를 화면 위로 둔다.
    expect(viewOf(0, 90 - 1e-3, 50.6)!.northDeg).toBeCloseTo(50.6, 6);
  });

  it('결과는 [0,360) 로 랩한다', () => {
    const view = viewOf(10, 45, 5)!;
    expect(view.northDeg).toBeCloseTo(355, 10);
    const wrapped = viewOf(0, 45, 360)!;
    expect(wrapped.northDeg).toBeGreaterThanOrEqual(0);
    expect(wrapped.northDeg).toBeLessThan(360);
  });

  it('정수직 탑뷰(전방 XZ = 0)에서도 위 벡터로 방향이 남는다', () => {
    const view = resolveCompassView(vec(0, -1, 0), vec(1, 0, 0), 0)!;
    // 화면 위쪽 = +X(월드 방위 90) → 북은 왼쪽.
    expect(view.northDeg).toBeCloseTo(270, 10);
    expect(view.tilt).toBe(1);
  });

  it('수평 시선(위 벡터 XZ = 0)에서도 전방으로 방향이 남는다', () => {
    const view = resolveCompassView(vec(0, 0, -1), vec(0, 1, 0), 0)!;
    expect(view.northDeg).toBeCloseTo(0, 10);
    expect(view.tilt).toBe(0);
  });
});

describe('resolveCompassView — 기울기', () => {
  it('내려다본 각의 사인이 세로 비율이다 — 탑뷰 1, 45° 약 0.707', () => {
    expect(viewOf(0, 90, 0)!.tilt).toBeCloseTo(1, 10);
    expect(viewOf(0, 45, 0)!.tilt).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('[0,1] 로 클램프한다 — 올려다보는 시선은 0, 정규화 오차로 1 을 넘는 값은 1', () => {
    expect(
      resolveCompassView(vec(0, 0.5, -0.8), vec(0, 0.8, 0.5), 0)!.tilt,
    ).toBe(0);
    expect(
      resolveCompassView(vec(0, -1.0000001, -1e-4), vec(0, 0, -1), 0)!.tilt,
    ).toBe(1);
  });
});

describe('resolveCompassView — 방어', () => {
  it('비유한 벡터 성분은 null', () => {
    expect(
      resolveCompassView(vec(Number.NaN, -1, 0), vec(0, 0, -1), 0),
    ).toBeNull();
    expect(
      resolveCompassView(vec(0, -1, 0), vec(0, 0, Number.POSITIVE_INFINITY), 0),
    ).toBeNull();
  });

  it('비유한 진북은 null — 잘못된 북쪽을 보이지 않는다', () => {
    const { forward, up } = cameraBasis(0, 45);
    expect(resolveCompassView(forward, up, Number.NaN)).toBeNull();
    expect(
      resolveCompassView(forward, up, Number.NEGATIVE_INFINITY),
    ).toBeNull();
  });

  it('화면 위쪽의 지면 방향이 퇴화하면(XZ 합 0) null', () => {
    expect(resolveCompassView(vec(0, -1, 0), vec(0, 1, 0), 0)).toBeNull();
    expect(resolveCompassView(vec(0, 0, 0), vec(0, 0, 0), 0)).toBeNull();
  });
});

describe('compassPlaneMatrix', () => {
  it('북 0·탑뷰면 항등', () => {
    const [a, b, c, d] = compassPlaneMatrix({ northDeg: 0, tilt: 1 });
    expect(a).toBeCloseTo(1, 12);
    expect(b).toBeCloseTo(0, 12);
    expect(c).toBeCloseTo(0, 12);
    expect(d).toBeCloseTo(1, 12);
  });

  it('바늘 끝(평면의 북)은 북쪽 각도로 돌고 세로만 tilt 배로 눌린다', () => {
    const tip = applyPlane({ northDeg: 90, tilt: 0.5 }, 0, -10);
    expect(tip.x).toBeCloseTo(10, 10);
    expect(tip.y).toBeCloseTo(0, 10);
    const down = applyPlane({ northDeg: 0, tilt: 0.5 }, 0, -10);
    expect(down.x).toBeCloseTo(0, 10);
    expect(down.y).toBeCloseTo(-5, 10);
  });

  it('tilt 0 이면 원이 가로 선으로 눌린다', () => {
    const p = applyPlane({ northDeg: 30, tilt: 0 }, 0, -10);
    expect(p.y).toBeCloseTo(0, 12);
  });
});

describe('compassLabelPosition', () => {
  const R = COMPASS_RING_RADIUS_PX + COMPASS_LABEL_OFFSET_PX;

  it('탑뷰·북 0 이면 N 위, E 오른쪽, S 아래, W 왼쪽', () => {
    const view = { northDeg: 0, tilt: 1 };
    const [n, e, s, w] = COMPASS_POINTS.map((point) =>
      compassLabelPosition(view, point.bearing),
    );
    expect(n.x).toBeCloseTo(0, 10);
    expect(n.y).toBeCloseTo(-R, 10);
    expect(e.x).toBeCloseTo(R, 10);
    expect(e.y).toBeCloseTo(0, 10);
    expect(s.y).toBeCloseTo(R, 10);
    expect(w.x).toBeCloseTo(-R, 10);
  });

  it('글자는 타원 위 자리(바늘 끝과 같은 방향)에서 바깥으로 띄운다', () => {
    const view = { northDeg: 50.6, tilt: 0.6 };
    const n = compassLabelPosition(view, 0);
    const ring = applyPlane(view, 0, -COMPASS_RING_RADIUS_PX);
    const ringLen = Math.hypot(ring.x, ring.y);
    expect(Math.hypot(n.x - ring.x, n.y - ring.y)).toBeCloseTo(
      COMPASS_LABEL_OFFSET_PX,
      10,
    );
    // 중심 → 원 위 자리 방향 그대로 바깥쪽.
    expect(n.x / ring.x).toBeCloseTo(
      (ringLen + COMPASS_LABEL_OFFSET_PX) / ringLen,
      10,
    );
  });

  it('납작해져도 위·아래 글자는 원 선에서 오프셋만큼 떨어진다', () => {
    const view = { northDeg: 0, tilt: 0.26 };
    const n = compassLabelPosition(view, 0);
    expect(n.y).toBeCloseTo(
      -(COMPASS_RING_RADIUS_PX * 0.26 + COMPASS_LABEL_OFFSET_PX),
      10,
    );
  });

  it('tilt 0 의 위·아래 자리(중심과 겹침)는 수직으로 띄운다', () => {
    const view = { northDeg: 0, tilt: 0 };
    const n = compassLabelPosition(view, 0);
    const s = compassLabelPosition(view, 180);
    expect(n.y).toBeCloseTo(-COMPASS_LABEL_OFFSET_PX, 10);
    expect(s.y).toBeCloseTo(COMPASS_LABEL_OFFSET_PX, 10);
    expect(n.x).toBeCloseTo(0, 10);
  });

  it('어떤 자세에서도 글자 중심이 SVG 상자 안에 있다', () => {
    const half = COMPASS_SIZE_PX / 2;
    for (let north = 0; north < 360; north += 15) {
      for (const tilt of [0, 0.26, 0.5, 1]) {
        for (const point of COMPASS_POINTS) {
          const { x, y } = compassLabelPosition(
            { northDeg: north, tilt },
            point.bearing,
          );
          // 글자 반폭·반높이 여유(약 5px)를 남긴다.
          expect(Math.abs(x)).toBeLessThan(half - 5);
          expect(Math.abs(y)).toBeLessThan(half - 5);
        }
      }
    }
  });
});
