import { describe, expect, it } from 'vitest';
import {
  computeTopViewFallbackPose,
  computeTopViewPose,
  ensureTopViewTilt,
  TOP_VIEW_MAX_DISTANCE,
  TOP_VIEW_PADDING,
  TOP_VIEW_TILT,
  type BoundsLike,
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

  it('거리 상한: 정확히 3000 이 되는 박스는 통과, 더 크면 3000 으로 잘린다', () => {
    // halfHeight/tan(30°)·1.08 = 3000 이 되는 z 크기.
    const limitZ =
      2 *
      ((TOP_VIEW_MAX_DISTANCE / TOP_VIEW_PADDING) *
        Math.tan((30 * Math.PI) / 180));
    const exact = computeTopViewPose(box(1, 2, limitZ), 1, FOV)!;
    expect(exact.position[1] - 1).toBeCloseTo(TOP_VIEW_MAX_DISTANCE, 6);

    const over = computeTopViewPose(box(1, 2, limitZ + 1), 1, FOV)!;
    expect(over.position[1] - 1).toBe(TOP_VIEW_MAX_DISTANCE);
    const huge = computeTopViewPose(box(100000, 2, 100000), 1, FOV)!;
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

describe('computeTopViewFallbackPose', () => {
  it('현재 카메라-타깃 거리를 유지한 채 타깃 바로 위로 올린다', () => {
    const pose = computeTopViewFallbackPose([0, 50, 50], [0, 0, 0]);
    const distance = Math.sqrt(5000);
    expect(pose.target).toEqual([0, 0, 0]);
    expect(pose.position[0]).toBe(0);
    expect(pose.position[1]).toBeCloseTo(distance, 9);
    expect(pose.position[2]).toBeCloseTo(distance * TOP_VIEW_TILT, 12);
  });

  it('타깃이 원점이 아니어도 타깃 기준으로 계산한다', () => {
    const pose = computeTopViewFallbackPose([13, 10, 4], [10, 10, 0]);
    expect(pose.target).toEqual([10, 10, 0]);
    expect(pose.position[1]).toBeCloseTo(15, 9);
    expect(pose.position[2]).toBeCloseTo(5 * TOP_VIEW_TILT, 12);
  });

  it('카메라와 타깃이 같으면 거리 0 — 타깃 그 자리(호출 측이 처리)', () => {
    const pose = computeTopViewFallbackPose([1, 2, 3], [1, 2, 3]);
    expect(pose.position).toEqual([1, 2, 3]);
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
