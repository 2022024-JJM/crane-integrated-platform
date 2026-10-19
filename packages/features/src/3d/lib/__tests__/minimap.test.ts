import { describe, expect, it } from 'vitest';
import type { BoundsLike } from '@crane/core/lib/top-view-pose';
import {
  CAMERA_GLYPH_SHAPE,
  MINIMAP_MIN_PX,
  MINIMAP_PADDING_RATIO,
  cameraFootprint,
  cameraGlyphPolygon,
  clampPanelPosition,
  panelPositionToRatio,
  panelRatioToPosition,
  computeMinimapFrame,
  isSamePose,
  minimapToWorld,
  nearestMarkerIndex,
  panPoseToPoint,
  viewPinHead,
  worldToMinimap,
  type MinimapPose,
} from '../minimap';

function box(
  min: [number, number, number],
  max: [number, number, number],
): BoundsLike {
  return {
    min: { x: min[0], y: min[1], z: min[2] },
    max: { x: max[0], y: max[1], z: max[2] },
  };
}

const EMPTY_BOX: BoundsLike = {
  min: { x: Infinity, y: Infinity, z: Infinity },
  max: { x: -Infinity, y: -Infinity, z: -Infinity },
};

describe('computeMinimapFrame', () => {
  it('긴 변이 maxPx 에 맞고 짧은 변은 종횡비를 따른다 (여백 포함)', () => {
    const frame = computeMinimapFrame(box([0, 0, 0], [200, 10, 100]), 512);
    expect(frame).not.toBeNull();
    const pad = 200 * MINIMAP_PADDING_RATIO;
    expect(frame!.minX).toBeCloseTo(-pad, 10);
    expect(frame!.worldWidth).toBeCloseTo(200 + pad * 2, 10);
    expect(frame!.pxWidth).toBe(512);
    // 세로: (100 + 2·3) / (200 + 2·6) × 512 ≈ 256
    expect(frame!.pxHeight).toBe(
      Math.round(
        ((100 + 100 * MINIMAP_PADDING_RATIO * 2) / (200 + pad * 2)) * 512,
      ),
    );
  });

  it('짧은 변이 하한 아래면 픽셀은 하한으로, 월드 범위는 그 축으로 넓어진다 (m/px 유지)', () => {
    const frame = computeMinimapFrame(box([0, 0, 0], [1000, 1, 10]), 512);
    expect(frame).not.toBeNull();
    expect(frame!.pxHeight).toBe(MINIMAP_MIN_PX);
    const unitsPerPx = frame!.worldWidth / frame!.pxWidth;
    expect(frame!.worldDepth / frame!.pxHeight).toBeCloseTo(unitsPerPx, 10);
    // 넓어진 범위는 원래 중심을 유지한다.
    expect(frame!.minZ + frame!.worldDepth / 2).toBeCloseTo(5, 10);
  });

  it('빈 박스·폭 0·NaN·maxPx 하한 미만은 null', () => {
    expect(computeMinimapFrame(EMPTY_BOX, 512)).toBeNull();
    expect(computeMinimapFrame(box([0, 0, 0], [0, 1, 10]), 512)).toBeNull();
    expect(computeMinimapFrame(box([0, 0, 0], [10, 1, NaN]), 512)).toBeNull();
    expect(
      computeMinimapFrame(box([0, 0, 0], [10, 1, 10]), MINIMAP_MIN_PX - 1),
    ).toBeNull();
    expect(computeMinimapFrame(box([0, 0, 0], [10, 1, 10]), NaN)).toBeNull();
  });

  it('maxPx 정확히 하한이면 통과', () => {
    const frame = computeMinimapFrame(
      box([0, 0, 0], [10, 1, 10]),
      MINIMAP_MIN_PX,
    );
    expect(frame?.pxWidth).toBe(MINIMAP_MIN_PX);
    expect(frame?.pxHeight).toBe(MINIMAP_MIN_PX);
  });
});

describe('worldToMinimap / minimapToWorld', () => {
  const frame = computeMinimapFrame(box([-100, 0, -50], [100, 5, 50]), 400)!;

  it('왕복 변환이 일치한다', () => {
    const { px, py } = worldToMinimap(frame, 37.5, -12.25);
    const back = minimapToWorld(frame, px, py);
    expect(back.x).toBeCloseTo(37.5, 8);
    expect(back.z).toBeCloseTo(-12.25, 8);
  });

  it('이미지 위쪽이 minZ, 왼쪽이 minX (탑뷰 기저 규약)', () => {
    const corner = worldToMinimap(frame, frame.minX, frame.minZ);
    expect(corner.px).toBeCloseTo(0, 10);
    expect(corner.py).toBeCloseTo(0, 10);
    const far = worldToMinimap(
      frame,
      frame.minX + frame.worldWidth,
      frame.minZ + frame.worldDepth,
    );
    expect(far.px).toBeCloseTo(frame.pxWidth, 10);
    expect(far.py).toBeCloseTo(frame.pxHeight, 10);
  });

  it('worldToMinimap 은 클램프하지 않고, minimapToWorld 는 이미지 안으로 클램프한다', () => {
    expect(worldToMinimap(frame, frame.minX - 100, 0).px).toBeLessThan(0);
    const clamped = minimapToWorld(frame, -999, frame.pxHeight + 999);
    expect(clamped.x).toBeCloseTo(frame.minX, 10);
    expect(clamped.z).toBeCloseTo(frame.minZ + frame.worldDepth, 10);
  });
});

describe('panPoseToPoint', () => {
  const pose: MinimapPose = { position: [10, 20, 30], target: [0, 1, 0] };

  it('타깃을 옮기고 카메라는 같은 오프셋을 유지한다 (높이·y 유지)', () => {
    const next = panPoseToPoint(pose, 100, -50);
    expect(next.target).toEqual([100, 1, -50]);
    expect(next.position).toEqual([110, 20, -20]);
  });

  it('NaN 은 원본 참조 그대로', () => {
    expect(panPoseToPoint(pose, NaN, 0)).toBe(pose);
    expect(panPoseToPoint(pose, 0, Infinity)).toBe(pose);
    expect(panPoseToPoint(pose, 0, NaN)).toBe(pose);
  });
});

describe('cameraFootprint', () => {
  it('+X 방향을 보면 heading 0, +Z 방향은 π/2, halfAngle 은 각의 절반', () => {
    const px = cameraFootprint(
      { position: [0, 10, 0], target: [10, 0, 0] },
      90,
    );
    expect(px.heading).toBeCloseTo(0, 10);
    expect(px.length).toBeCloseTo(10, 10);
    expect(px.halfAngle).toBeCloseTo(Math.PI / 4, 10);
    const pz = cameraFootprint(
      { position: [0, 10, 0], target: [0, 0, 10] },
      90,
    );
    expect(pz.heading).toBeCloseTo(Math.PI / 2, 10);
  });

  it('정수직(타깃 바로 위)은 길이 0·heading 0', () => {
    const fp = cameraFootprint(
      { position: [5, 100, 5], target: [5, 0, 5] },
      60,
    );
    expect(fp.length).toBe(0);
    expect(fp.heading).toBe(0);
    expect(fp.x).toBe(5);
    expect(fp.z).toBe(5);
  });
});

describe('isSamePose', () => {
  const pose: MinimapPose = { position: [10, 20, 30], target: [0, 1, 0] };

  it('같은 값이면 true, 각 축 차이가 epsilon 정확값이면 true·넘으면 false', () => {
    expect(
      isSamePose(pose, { position: [10, 20, 30], target: [0, 1, 0] }, 0),
    ).toBe(true);
    // 2진수로 정확한 값만 써서 경계가 부동소수 오차에 흔들리지 않게 한다.
    const eps = 0.25;
    expect(
      isSamePose(pose, { position: [10.25, 20, 30], target: [0, 1, 0] }, eps),
    ).toBe(true);
    expect(
      isSamePose(pose, { position: [10.5, 20, 30], target: [0, 1, 0] }, eps),
    ).toBe(false);
    expect(
      isSamePose(pose, { position: [10, 20, 30], target: [0, 1, -0.25] }, eps),
    ).toBe(true);
    expect(
      isSamePose(pose, { position: [10, 20, 30], target: [0, 1, -0.5] }, eps),
    ).toBe(false);
  });

  it('위치가 같아도 타깃이 다르면(같은 자리에서 다른 곳을 봄) false', () => {
    expect(
      isSamePose(pose, { position: [10, 20, 30], target: [5, 1, 0] }, 1e-3),
    ).toBe(false);
  });

  it('NaN·Infinity 가 섞이면 false (epsilon 이 NaN 이어도)', () => {
    expect(
      isSamePose(pose, { position: [NaN, 20, 30], target: [0, 1, 0] }, 1),
    ).toBe(false);
    expect(
      isSamePose(pose, { position: [10, 20, 30], target: [0, Infinity, 0] }, 1),
    ).toBe(false);
    expect(isSamePose(pose, pose, NaN)).toBe(false);
  });
});

describe('viewPinHead', () => {
  it('머리는 끝점에서 stem 위, 같은 x', () => {
    expect(viewPinHead(50, 40, 11, 6)).toEqual({
      px: 50,
      py: 29,
      flipped: false,
    });
  });

  it('머리 윗가장자리가 정확히 0 이면 위로, 그보다 위로 나가면 아래로 뒤집는다', () => {
    // 17 - 11 - 6 = 0 → 경계 정확값은 위로
    expect(viewPinHead(50, 17, 11, 6)).toEqual({
      px: 50,
      py: 6,
      flipped: false,
    });
    expect(viewPinHead(50, 16.5, 11, 6)).toEqual({
      px: 50,
      py: 27.5,
      flipped: true,
    });
    // 끝점이 이미지 위 가장자리(0)
    expect(viewPinHead(50, 0, 11, 6)).toEqual({
      px: 50,
      py: 11,
      flipped: true,
    });
  });
});

describe('nearestMarkerIndex', () => {
  const markers = [
    { px: 10, py: 10 },
    { px: 20, py: 10 },
    { px: 100, py: 100 },
  ];

  it('반경 안 최근접 인덱스, 경계 정확값 포함', () => {
    expect(nearestMarkerIndex(markers, 14, 10, 8)).toBe(0);
    expect(nearestMarkerIndex(markers, 16, 10, 8)).toBe(1);
    expect(nearestMarkerIndex(markers, 18, 10, 8)).toBe(0 + 1);
    // 정확히 반경 거리 = 포함
    expect(nearestMarkerIndex(markers, 108, 100, 8)).toBe(2);
    // 반경 밖
    expect(nearestMarkerIndex(markers, 108.01, 100, 8)).toBe(-1);
  });

  it('빈 목록은 -1', () => {
    expect(nearestMarkerIndex([], 0, 0, 8)).toBe(-1);
  });
});

describe('clampPanelPosition', () => {
  it('안이면 그대로, 밖이면 경계로', () => {
    expect(clampPanelPosition({ x: 10, y: 20 }, 100, 50, 500, 300)).toEqual({
      x: 10,
      y: 20,
    });
    expect(clampPanelPosition({ x: -5, y: 999 }, 100, 50, 500, 300)).toEqual({
      x: 0,
      y: 250,
    });
    // 경계 정확값 = 통과, +1 = 클램프
    expect(clampPanelPosition({ x: 400, y: 250 }, 100, 50, 500, 300)).toEqual({
      x: 400,
      y: 250,
    });
    expect(clampPanelPosition({ x: 401, y: 251 }, 100, 50, 500, 300)).toEqual({
      x: 400,
      y: 250,
    });
  });

  it('패널이 컨테이너보다 크면 0, NaN 좌표는 0', () => {
    expect(clampPanelPosition({ x: 50, y: 50 }, 600, 400, 500, 300)).toEqual({
      x: 0,
      y: 0,
    });
    expect(clampPanelPosition({ x: NaN, y: NaN }, 10, 10, 500, 300)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('panelPositionToRatio / panelRatioToPosition', () => {
  // 패널 100×50, 컨테이너 500×300 → 여유 400×250.
  const PANEL = [100, 50] as const;
  const BOX = [500, 300] as const;

  it('좌상단 = (0,0), 우하단 = (1,1), 중앙 = (0.5,0.5)', () => {
    expect(panelPositionToRatio({ x: 0, y: 0 }, ...PANEL, ...BOX)).toEqual({
      fx: 0,
      fy: 0,
    });
    expect(panelPositionToRatio({ x: 400, y: 250 }, ...PANEL, ...BOX)).toEqual({
      fx: 1,
      fy: 1,
    });
    expect(panelPositionToRatio({ x: 200, y: 125 }, ...PANEL, ...BOX)).toEqual({
      fx: 0.5,
      fy: 0.5,
    });
  });

  it('여유 밖 px 는 비율 [0,1] 로 클램프, NaN 은 0', () => {
    expect(panelPositionToRatio({ x: -10, y: 999 }, ...PANEL, ...BOX)).toEqual({
      fx: 0,
      fy: 1,
    });
    expect(panelPositionToRatio({ x: NaN, y: NaN }, ...PANEL, ...BOX)).toEqual({
      fx: 0,
      fy: 0,
    });
  });

  it('패널이 컨테이너 이상이면 그 축은 0 (0 나누기 없음)', () => {
    expect(panelPositionToRatio({ x: 50, y: 50 }, 500, 50, ...BOX)).toEqual({
      fx: 0,
      fy: 0.2,
    });
    expect(panelPositionToRatio({ x: 50, y: 50 }, 600, 400, ...BOX)).toEqual({
      fx: 0,
      fy: 0,
    });
  });

  it('비율 → px 는 여유 공간에 곱하고 범위 밖·NaN 비율은 클램프', () => {
    expect(panelRatioToPosition({ fx: 1, fy: 1 }, ...PANEL, ...BOX)).toEqual({
      x: 400,
      y: 250,
    });
    expect(
      panelRatioToPosition({ fx: 0.5, fy: 0.5 }, ...PANEL, ...BOX),
    ).toEqual({ x: 200, y: 125 });
    expect(
      panelRatioToPosition({ fx: 1.1, fy: -0.1 }, ...PANEL, ...BOX),
    ).toEqual({ x: 400, y: 0 });
    expect(
      panelRatioToPosition({ fx: NaN, fy: Infinity }, ...PANEL, ...BOX),
    ).toEqual({ x: 0, y: 0 });
    // 패널이 컨테이너보다 크면 0.
    expect(panelRatioToPosition({ fx: 1, fy: 1 }, 600, 400, ...BOX)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('우하단 비율은 컨테이너가 커져도(전체화면) 우하단 px 로 복원된다', () => {
    const ratio = panelPositionToRatio({ x: 400, y: 250 }, ...PANEL, ...BOX);
    expect(panelRatioToPosition(ratio, ...PANEL, 1920, 1080)).toEqual({
      x: 1820,
      y: 1030,
    });
    // px → 비율 → px 왕복은 같은 컨테이너에서 원값.
    expect(
      panelRatioToPosition(
        panelPositionToRatio({ x: 120, y: 75 }, ...PANEL, ...BOX),
        ...PANEL,
        ...BOX,
      ),
    ).toEqual({ x: 120, y: 75 });
  });
});

describe('cameraGlyphPolygon', () => {
  it('heading 0 이면 렌즈 앞이 +x, π/2 면 +y(이미지 아래) 로 향한다', () => {
    const right = cameraGlyphPolygon(10, 20, 0, 10);
    const rightFront = Math.max(...right.map((p) => p.px));
    const rightRear = Math.min(...right.map((p) => p.px));
    expect(rightFront).toBeCloseTo(18.5, 10);
    expect(rightRear).toBeCloseTo(0, 10);
    const down = cameraGlyphPolygon(10, 20, Math.PI / 2, 10);
    expect(Math.max(...down.map((p) => p.py))).toBeCloseTo(28.5, 10);
    expect(Math.min(...down.map((p) => p.py))).toBeCloseTo(10, 10);
    // 회전해도 가로 폭은 좌우 대칭이다.
    expect(Math.max(...down.map((p) => p.px)) - 10).toBeCloseTo(
      10 - Math.min(...down.map((p) => p.px)),
      10,
    );
  });

  it('점 수·순서는 CAMERA_GLYPH_SHAPE 를 따르고 heading 축에 대칭이다', () => {
    const points = cameraGlyphPolygon(0, 0, 0, 10);
    expect(points).toHaveLength(CAMERA_GLYPH_SHAPE.length);
    const n = points.length;
    for (let i = 0; i < n / 2; i += 1) {
      expect(points[i].px).toBeCloseTo(points[n - 1 - i].px, 10);
      expect(points[i].py).toBeCloseTo(-points[n - 1 - i].py, 10);
    }
  });

  it('size 0·NaN 은 원점, heading NaN 은 0 으로 본다(NaN 없음)', () => {
    for (const points of [
      cameraGlyphPolygon(3, 4, 1, 0),
      cameraGlyphPolygon(3, 4, 1, Number.NaN),
    ]) {
      for (const point of points) {
        expect(point.px).toBeCloseTo(3, 10);
        expect(point.py).toBeCloseTo(4, 10);
      }
    }
    const nanHeading = cameraGlyphPolygon(0, 0, Number.NaN, 5);
    const zeroHeading = cameraGlyphPolygon(0, 0, 0, 5);
    nanHeading.forEach((p, i) => {
      expect(p.px).toBeCloseTo(zeroHeading[i].px, 10);
      expect(p.py).toBeCloseTo(zeroHeading[i].py, 10);
    });
  });
});
