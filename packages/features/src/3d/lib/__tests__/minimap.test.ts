import { describe, expect, it } from 'vitest';
import type { BoundsLike } from '@crane/core/lib/top-view-pose';
import {
  MINIMAP_MIN_PX,
  MINIMAP_PADDING_RATIO,
  cameraFootprint,
  clampPanelPosition,
  computeMinimapFrame,
  horizontalFovDeg,
  minimapToWorld,
  nearestMarkerIndex,
  panPoseToPoint,
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

describe('horizontalFovDeg', () => {
  it('종횡비 1 이면 세로 fov 와 같다', () => {
    expect(horizontalFovDeg(60, 1)).toBeCloseTo(60, 10);
  });

  it('16:9 · 75° → 약 107.5°', () => {
    expect(horizontalFovDeg(75, 16 / 9)).toBeCloseTo(107.5, 1);
  });
});

describe('cameraFootprint', () => {
  it('+X 방향을 보면 heading 0, +Z 방향은 π/2', () => {
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
