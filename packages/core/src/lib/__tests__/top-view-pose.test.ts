import { describe, expect, it } from 'vitest';
import {
  computeTopViewEntryPose,
  computeTopViewExitPose,
  computeTopViewPose,
  ensureTopViewTilt,
  headingOfPose,
  orthoHalfHeightForDistance,
  PERSPECTIVE_FOV_USER_DATA_KEY,
  resolveCameraAspect,
  resolveCameraFov,
  scalePoseAboutPoint,
  setOrthoFrustum,
  TOP_VIEW_MAX_DISTANCE,
  TOP_VIEW_PADDING,
  TOP_VIEW_POLAR_ANGLE,
  TOP_VIEW_TILT,
  type BoundsLike,
  type CameraPose,
} from '../top-view-pose';
import type { Vector3Tuple } from '../../types/math';

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

const FOV = 60;
/** 100×10×100 박스, aspect 1, fov 60 일 때의 기대 거리. */
const BASE_DISTANCE = (50 / Math.tan((30 * Math.PI) / 180)) * TOP_VIEW_PADDING;

describe('computeTopViewPose — 기본', () => {
  it('빈 박스는 null', () => {
    expect(computeTopViewPose(EMPTY_BOX, 1, FOV)).toBeNull();
  });

  it('한 축만 min > max 여도 빈 박스', () => {
    const b = box(10, 10, 10);
    expect(
      computeTopViewPose({ ...b, min: { ...b.min, y: b.max.y + 1 } }, 1, FOV),
    ).toBeNull();
  });

  it('크기 0 박스(min === max)는 비어 있지 않다 — 타깃 위 minDistance', () => {
    const pose = computeTopViewPose(box(0, 0, 0, [1, 2, 3]), 1, FOV, {
      minDistance: 10,
    })!;
    expect(pose.target).toEqual([1, 2, 3]);
    expect(pose.position[1]).toBe(12);
  });

  it('원점 박스: 타깃은 중심, 카메라는 박스 윗면(max.y) 기준 거리만큼 위', () => {
    const pose = computeTopViewPose(box(100, 10, 100), 1, FOV)!;
    expect(pose.target).toEqual([0, 0, 0]);
    expect(pose.position[0]).toBeCloseTo(0, 9);
    // center.y(0)가 아니라 max.y(5)에서 시작한다.
    expect(pose.position[1]).toBeCloseTo(5 + BASE_DISTANCE, 9);
    expect(BASE_DISTANCE).toBeCloseTo(93.53, 2);
  });

  it('정수직이 아니라 +Z 로 거리×TOP_VIEW_TILT 만큼 기울어 있다', () => {
    const pose = computeTopViewPose(box(100, 10, 100), 1, FOV)!;
    expect(pose.position[2]).toBeCloseTo(BASE_DISTANCE * TOP_VIEW_TILT, 12);
    expect(pose.position[2]).toBeGreaterThan(0);
  });

  it('오프센터 박스: 타깃과 카메라 XZ 가 박스 중심을 따라간다', () => {
    const pose = computeTopViewPose(box(20, 4, 20, [300, 7, -120]), 1, FOV)!;
    expect(pose.target).toEqual([300, 7, -120]);
    expect(pose.position[0]).toBe(300);
    expect(pose.position[2]).toBeCloseTo(
      -120 + (pose.position[1] - 9) * TOP_VIEW_TILT,
      9,
    );
  });
});

describe('computeTopViewPose — 종횡비', () => {
  it('가로가 긴 박스는 aspect 가 클수록 가까워진다 (halfHeight = x/(2·aspect))', () => {
    const wide = box(200, 2, 50);
    const at2 = computeTopViewPose(wide, 2, FOV)!;
    const atHalf = computeTopViewPose(wide, 0.5, FOV)!;
    // aspect 2 → halfHeight 50, aspect 0.5 → 200 : 4배 거리.
    expect((atHalf.position[1] - 1) / (at2.position[1] - 1)).toBeCloseTo(4, 9);
  });

  it('세로(z)가 더 크면 aspect 와 무관하게 z 가 기준', () => {
    const tall = box(10, 2, 100);
    const a = computeTopViewPose(tall, 1, FOV)!;
    const b = computeTopViewPose(tall, 4, FOV)!;
    expect(a.position[1]).toBeCloseTo(b.position[1], 9);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    '잘못된 aspect(%s)는 1 로 취급한다',
    (aspect) => {
      const b = box(100, 10, 100);
      expect(computeTopViewPose(b, aspect, FOV)).toEqual(
        computeTopViewPose(b, 1, FOV),
      );
    },
  );
});

describe('computeTopViewPose — 옵션·클램프', () => {
  it('padding 1 은 기본(1.08)의 1/1.08 거리', () => {
    const b = box(100, 10, 100);
    const padded = computeTopViewPose(b, 1, FOV)!;
    const tight = computeTopViewPose(b, 1, FOV, { padding: 1 })!;
    expect((tight.position[1] - 5) / (padded.position[1] - 5)).toBeCloseTo(
      1 / TOP_VIEW_PADDING,
      9,
    );
  });

  it('거리 상한: 정확히 상한이 되는 박스는 통과, 더 크면 상한으로 잘린다', () => {
    // halfHeight/tan(30°)·1.08 = TOP_VIEW_MAX_DISTANCE 가 되는 z 크기.
    const limitZ =
      2 *
      ((TOP_VIEW_MAX_DISTANCE / TOP_VIEW_PADDING) *
        Math.tan((30 * Math.PI) / 180));
    const exact = computeTopViewPose(box(1, 2, limitZ), 1, FOV)!;
    expect(exact.position[1] - 1).toBeCloseTo(TOP_VIEW_MAX_DISTANCE, 6);

    const over = computeTopViewPose(box(1, 2, limitZ + 1), 1, FOV)!;
    expect(over.position[1] - 1).toBe(TOP_VIEW_MAX_DISTANCE);
    const huge = computeTopViewPose(box(1_000_000, 2, 1_000_000), 1, FOV)!;
    expect(huge.position[1] - 1).toBe(TOP_VIEW_MAX_DISTANCE);
  });

  it('거리 하한: 작은 박스는 minDistance 로 올린다', () => {
    const pose = computeTopViewPose(box(0.2, 0.2, 0.2), 1, FOV, {
      minDistance: 60,
    })!;
    expect(pose.position[1] - 0.1).toBe(60);
  });

  it('maxDistance 옵션이 기본 상한을 대체한다', () => {
    const pose = computeTopViewPose(box(100000, 2, 100000), 1, FOV, {
      maxDistance: 500,
    })!;
    expect(pose.position[1] - 1).toBe(500);
  });
});

describe('headingOfPose', () => {
  it('카메라 → 타깃의 수평 방향을 단위 벡터로 돌려준다', () => {
    expect(headingOfPose([0, 10, 10], [0, 0, 0])).toEqual([0, -1]);
    const h = headingOfPose([-3, 4, -3], [0, 0, 0])!;
    expect(h[0]).toBeCloseTo(Math.SQRT1_2, 12);
    expect(h[1]).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it('정수직·노이즈 수준(tilt/2 미만)·거리 0·NaN 은 null', () => {
    expect(headingOfPose([0, 10, 0], [0, 0, 0])).toBeNull();
    expect(headingOfPose([0, 10, 10 * TOP_VIEW_TILT * 0.49], [0, 0, 0])).toBe(
      null,
    );
    expect(headingOfPose([1, 2, 3], [1, 2, 3])).toBeNull();
    expect(headingOfPose([NaN, 10, 0], [0, 0, 0])).toBeNull();
  });

  it('정규 tilt 포즈(옆 오프셋 = 거리×tilt)는 방향이 나온다', () => {
    const tilted = ensureTopViewTilt([0, 10, 0], [0, 0, 0]);
    expect(headingOfPose(tilted, [0, 0, 0])).toEqual([0, -1]);
  });
});

describe('computeTopViewEntryPose', () => {
  it('현재 거리를 정확히 유지한 채 타깃 위로, 보던 방향의 반대쪽으로 기울인다', () => {
    // 남쪽(+Z)에서 북쪽(-Z)을 보던 카메라 — 화면 위가 -Z 여야 하므로 +Z 로 기운다.
    const pose = computeTopViewEntryPose([0, 50, 50], [0, 0, 0]);
    const distance = Math.sqrt(5000);
    expect(pose.target).toEqual([0, 0, 0]);
    expect(pose.position[0]).toBeCloseTo(0, 12);
    expect(pose.position[2]).toBeGreaterThan(0);
    expect(Math.hypot(...pose.position)).toBeCloseTo(distance, 9);
    expect(pose.position[2] / pose.position[1]).toBeCloseTo(TOP_VIEW_TILT, 12);
  });

  it('동쪽(+X)을 보던 카메라는 -X 쪽으로 기운다 — 화면 위 = 동쪽', () => {
    const pose = computeTopViewEntryPose([-30, 40, 0], [0, 0, 0]);
    expect(pose.position[0]).toBeLessThan(0);
    expect(pose.position[2]).toBeCloseTo(0, 12);
    expect(headingOfPose(pose.position, pose.target)).toEqual([1, 0]);
  });

  it('이미 정수직이면 -Z 기준(+Z 로 기움)', () => {
    const pose = computeTopViewEntryPose([0, 30, 0], [0, 0, 0]);
    expect(headingOfPose(pose.position, pose.target)).toEqual([0, -1]);
    expect(Math.hypot(...pose.position)).toBeCloseTo(30, 9);
  });

  it('타깃이 원점이 아니어도 타깃 기준이고, 진입 포즈는 ensureTopViewTilt 를 통과해도 그대로', () => {
    const pose = computeTopViewEntryPose([13, 10, 4], [10, 10, 0]);
    expect(pose.target).toEqual([10, 10, 0]);
    expect(pose.position[1]).toBeCloseTo(15, 4);
    expect(ensureTopViewTilt(pose.position, pose.target)).toBe(pose.position);
  });

  it('극각은 정확히 TOP_VIEW_POLAR_ANGLE', () => {
    const pose = computeTopViewEntryPose([0, 50, 50], [0, 0, 0]);
    const [x, y, z] = pose.position;
    expect(Math.atan2(Math.hypot(x, z), y)).toBeCloseTo(
      TOP_VIEW_POLAR_ANGLE,
      12,
    );
  });

  it('카메라와 타깃이 같으면 거리 0 — 타깃 그 자리(호출 측이 처리)', () => {
    const pose = computeTopViewEntryPose([1, 2, 3], [1, 2, 3]);
    expect(pose.position).toEqual([1, 2, 3]);
  });
});

describe('computeTopViewExitPose', () => {
  const saved: CameraPose = { position: [0, 30, 40], target: [0, 0, 0] };

  it('탑뷰에서 아무것도 안 했으면 진입 전 포즈 그대로', () => {
    const entry = computeTopViewEntryPose(saved.position, saved.target);
    const exit = computeTopViewExitPose(saved, entry);
    expect(exit.target).toEqual([0, 0, 0]);
    exit.position.forEach((v, i) =>
      expect(v).toBeCloseTo(saved.position[i], 9),
    );
  });

  it('팬: 중심이 옮겨진 만큼 오프셋째 따라간다(기울기·거리 유지)', () => {
    const entry = computeTopViewEntryPose(saved.position, saved.target);
    const panned: CameraPose = {
      position: [
        entry.position[0] + 100,
        entry.position[1],
        entry.position[2] - 20,
      ],
      target: [100, 0, -20],
    };
    const exit = computeTopViewExitPose(saved, panned);
    expect(exit.target).toEqual([100, 0, -20]);
    expect(exit.position[0]).toBeCloseTo(100, 9);
    expect(exit.position[1]).toBeCloseTo(30, 9);
    expect(exit.position[2]).toBeCloseTo(20, 9);
  });

  it('줌: 현재 거리로 스케일 — 반으로 다가갔으면 오프셋도 절반', () => {
    const entry = computeTopViewEntryPose(saved.position, saved.target);
    const zoomed = scalePoseAboutPoint(entry, entry.target, 0.5);
    const exit = computeTopViewExitPose(saved, zoomed);
    expect(exit.position[1]).toBeCloseTo(15, 9);
    expect(exit.position[2]).toBeCloseTo(20, 9);
  });

  it('방위 회전: 탑뷰에서 90° 돌렸으면 복귀 시선도 90° 돈다', () => {
    // 진입 때 -Z 를 보던 카메라(+Z 쪽에 있음). 탑뷰에서 화면 위가 +X 가 되도록
    // 돌린 상태 = 기울임이 -X 쪽(카메라 → 타깃 방향이 +X).
    const r = 50;
    const rotated: CameraPose = {
      position: [-r * TOP_VIEW_TILT, r, 0],
      target: [0, 0, 0],
    };
    const exit = computeTopViewExitPose(saved, rotated);
    // 시선이 +X 를 향하므로 카메라는 -X 쪽에 있어야 한다(z 는 0). 현재 거리가
    // 50·√(1+tilt²) 라 1e-6 상대 오차는 허용.
    expect(exit.position[0]).toBeCloseTo(-40, 4);
    expect(exit.position[1]).toBeCloseTo(30, 4);
    expect(exit.position[2]).toBeCloseTo(0, 9);
  });

  it('저장 포즈가 정수직(방위 없음)이면 회전 없이 스케일만', () => {
    const vertical: CameraPose = { position: [0, 20, 0], target: [0, 0, 0] };
    const current: CameraPose = {
      position: [5 - 10 * TOP_VIEW_TILT, 10, 5],
      target: [5, 0, 5],
    };
    const exit = computeTopViewExitPose(vertical, current);
    expect(exit.position[0]).toBeCloseTo(5, 12);
    expect(exit.position[1]).toBeCloseTo(10, 4);
    expect(exit.position[2]).toBeCloseTo(5, 12);
  });

  it('저장 거리 0·NaN 은 현재 포즈 복사(입력 참조는 아님)', () => {
    const current: CameraPose = { position: [1, 9, 1], target: [1, 0, 1] };
    const zero = computeTopViewExitPose(
      { position: [3, 3, 3], target: [3, 3, 3] },
      current,
    );
    expect(zero).toEqual(current);
    expect(zero.position).not.toBe(current.position);
    const nan = computeTopViewExitPose(
      { position: [NaN, 3, 3], target: [3, 3, 3] },
      current,
    );
    expect(nan).toEqual(current);
  });

  it('현재 거리가 0 이면 스케일 1 — 저장 오프셋을 현재 타깃에 그대로 붙인다', () => {
    const exit = computeTopViewExitPose(saved, {
      position: [7, 0, 7],
      target: [7, 0, 7],
    });
    expect(exit.position).toEqual([7, 30, 47]);
  });
});

describe('scalePoseAboutPoint', () => {
  const pose: CameraPose = { position: [0, 10, 10], target: [0, 0, 0] };

  it('점 기준으로 카메라·타깃을 같은 배율로 — 타깃 기준이면 거리만 바뀐다', () => {
    const half = scalePoseAboutPoint(pose, pose.target, 0.5);
    expect(half.target).toEqual([0, 0, 0]);
    expect(half.position).toEqual([0, 5, 5]);
  });

  it('점이 타깃이 아니면 타깃도 그 점 쪽으로 움직인다(커서 기준 줌)', () => {
    const scaled = scalePoseAboutPoint(pose, [10, 0, 0], 2);
    expect(scaled.target).toEqual([-10, 0, 0]);
    expect(scaled.position).toEqual([-10, 20, 20]);
  });

  it('배율 1 은 값이 같고, 0·음수·NaN·∞ 는 입력 참조 그대로', () => {
    expect(scalePoseAboutPoint(pose, [3, 3, 3], 1)).toEqual(pose);
    expect(scalePoseAboutPoint(pose, [3, 3, 3], 0)).toBe(pose);
    expect(scalePoseAboutPoint(pose, [3, 3, 3], -1)).toBe(pose);
    expect(scalePoseAboutPoint(pose, [3, 3, 3], NaN)).toBe(pose);
    expect(scalePoseAboutPoint(pose, [3, 3, 3], Infinity)).toBe(pose);
  });
});

describe('orthoHalfHeightForDistance', () => {
  it('거리 × tan(fov/2)', () => {
    expect(orthoHalfHeightForDistance(100, 90)).toBeCloseTo(100, 9);
    expect(orthoHalfHeightForDistance(10, 60)).toBeCloseTo(
      10 * Math.tan(Math.PI / 6),
      12,
    );
  });

  it('거리 0·음수·NaN 과 퇴화 fov(0·180·NaN)는 0', () => {
    expect(orthoHalfHeightForDistance(0, 60)).toBe(0);
    expect(orthoHalfHeightForDistance(-1, 60)).toBe(0);
    expect(orthoHalfHeightForDistance(NaN, 60)).toBe(0);
    expect(orthoHalfHeightForDistance(10, 0)).toBe(0);
    expect(orthoHalfHeightForDistance(10, 180)).toBe(0);
    expect(orthoHalfHeightForDistance(10, NaN)).toBe(0);
  });
});

describe('setOrthoFrustum', () => {
  function frustum() {
    let updates = 0;
    const cam = {
      left: -1,
      right: 1,
      top: 1,
      bottom: -1,
      updateProjectionMatrix: () => {
        updates += 1;
      },
      get updates() {
        return updates;
      },
    };
    return cam;
  }

  it('반높이·종횡비로 네 변을 쓰고 투영을 갱신한다', () => {
    const cam = frustum();
    setOrthoFrustum(cam, 10, 2);
    expect([cam.left, cam.right, cam.top, cam.bottom]).toEqual([
      -20, 20, 10, -10,
    ]);
    expect(cam.updates).toBe(1);
  });

  it('같은 값이면 갱신하지 않는다(no-op)', () => {
    const cam = frustum();
    setOrthoFrustum(cam, 10, 2);
    setOrthoFrustum(cam, 10, 2);
    expect(cam.updates).toBe(1);
  });

  it('반높이 0·음수·NaN 은 손대지 않고, 종횡비가 이상하면 1 로 본다', () => {
    const cam = frustum();
    setOrthoFrustum(cam, 0, 2);
    setOrthoFrustum(cam, NaN, 2);
    expect(cam.updates).toBe(0);
    setOrthoFrustum(cam, 5, NaN);
    expect([cam.left, cam.right]).toEqual([-5, 5]);
  });
});

describe('resolveCameraFov / resolveCameraAspect', () => {
  it('원근 카메라는 자기 fov·aspect', () => {
    const cam = { isPerspectiveCamera: true, fov: 50, aspect: 1.5 };
    expect(resolveCameraFov(cam)).toBe(50);
    expect(resolveCameraAspect(cam)).toBe(1.5);
  });

  it('직교 탑뷰 카메라는 userData 의 원근 fov 와 프러스텀 비', () => {
    const cam = {
      isOrthographicCamera: true,
      left: -20,
      right: 20,
      top: 10,
      bottom: -10,
      userData: { [PERSPECTIVE_FOV_USER_DATA_KEY]: 75 },
    };
    expect(resolveCameraFov(cam)).toBe(75);
    expect(resolveCameraAspect(cam)).toBe(2);
  });

  it('fov 를 모르는 직교 카메라(미니맵 캡처)·오염된 값은 null', () => {
    expect(resolveCameraFov({ isOrthographicCamera: true })).toBeNull();
    expect(
      resolveCameraFov({
        isOrthographicCamera: true,
        userData: { [PERSPECTIVE_FOV_USER_DATA_KEY]: 'wide' },
      }),
    ).toBeNull();
    expect(
      resolveCameraFov({ isPerspectiveCamera: true, fov: NaN }),
    ).toBeNull();
    expect(resolveCameraAspect({ isPerspectiveCamera: true, aspect: 0 })).toBe(
      null,
    );
    expect(
      resolveCameraAspect({ left: -1, right: 1, top: 0, bottom: 0 }),
    ).toBeNull();
    expect(resolveCameraAspect({})).toBeNull();
  });
});

describe('ensureTopViewTilt', () => {
  const target: Vector3Tuple = [10, -5, 20];

  it('정확히 정수직이면 +Z 로 거리×TOP_VIEW_TILT 만큼 기울인다 (x·y 유지)', () => {
    const out = ensureTopViewTilt([10, 95, 20], target);
    expect(out).toEqual([10, 95, 20 + 100 * TOP_VIEW_TILT]);
  });

  it('노이즈 수준(거리×1e-9)으로만 벗어난 포즈도 같은 정규값으로 스냅한다', () => {
    const noisy: Vector3Tuple = [10 + 1e-7, 95, 20 - 1e-7];
    expect(ensureTopViewTilt(noisy, target)).toEqual(
      ensureTopViewTilt([10, 95, 20], target),
    );
  });

  it('이미 tilt 만큼 기울어 있으면(정규 포즈) 입력 참조 그대로', () => {
    const tilted: Vector3Tuple = [10, 95, 20 + 100 * TOP_VIEW_TILT];
    expect(ensureTopViewTilt(tilted, target)).toBe(tilted);
  });

  it('경계: 옆 오프셋 tilt/2 바로 위는 통과, 바로 아래는 스냅', () => {
    // 거리는 옆 오프셋을 포함하므로 경계값을 역산한다:
    // lateral = distance·TILT/2, distance² = dy² + lateral².
    // 정확한 경계는 부동소수 반올림에 따라 어느 쪽에도 떨어질 수 있어
    // ±0.1% 로 양쪽을 본다.
    const dy = 100;
    const k = TOP_VIEW_TILT / 2;
    const lateral = (dy * k) / Math.sqrt(1 - k * k);
    const over: Vector3Tuple = [10 + lateral * 1.001, 95, 20];
    expect(ensureTopViewTilt(over, target)).toBe(over);

    const under: Vector3Tuple = [10 + lateral * 0.999, 95, 20];
    const out = ensureTopViewTilt(under, target);
    expect(out).not.toBe(under);
    expect(out[0]).toBe(10);
    expect(out[2]).toBeGreaterThan(20);
  });

  it('비스듬한 일반 포즈는 입력 참조 그대로', () => {
    const oblique: Vector3Tuple = [60, 45, 70];
    expect(ensureTopViewTilt(oblique, target)).toBe(oblique);
  });

  it('타깃 아래서 위를 보는 정수직도 +Z 로 기울인다', () => {
    const out = ensureTopViewTilt([10, -105, 20], target);
    expect(out).toEqual([10, -105, 20 + 100 * TOP_VIEW_TILT]);
  });

  it('거리 0(카메라 = 타깃)은 판단 불가 — 입력 그대로', () => {
    const p: Vector3Tuple = [10, -5, 20];
    expect(ensureTopViewTilt(p, target)).toBe(p);
  });

  it.each([[[NaN, 95, 20]], [[10, Infinity, 20]]] as [Vector3Tuple][])(
    '비정상 성분 %j 은 예외 없이 입력 그대로',
    (p) => {
      expect(ensureTopViewTilt(p, target)).toBe(p);
    },
  );

  it('computeTopViewPose 결과는 이미 정규 포즈라 통과해도 변하지 않는다', () => {
    const pose = computeTopViewPose(box(100, 10, 100), 1, FOV)!;
    expect(ensureTopViewTilt(pose.position, pose.target)).toBe(pose.position);
  });
});
