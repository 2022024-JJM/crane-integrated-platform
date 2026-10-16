import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import {
  LABEL_ANCHOR_FALLBACK,
  LABEL_ANCHOR_TOP_PADDING,
  defaultLabelAnchorFromBox,
  planLabelAnchorFromBoxes,
} from '../model-label-anchor';

function box(
  min: [number, number, number],
  max: [number, number, number],
): Box3 {
  return new Box3(new Vector3(...min), new Vector3(...max));
}

describe('defaultLabelAnchorFromBox', () => {
  it('bbox XZ 중심, 꼭대기 + 여유', () => {
    expect(defaultLabelAnchorFromBox(box([-2, 0, -4], [6, 10, 4]))).toEqual([
      2,
      10 + LABEL_ANCHOR_TOP_PADDING,
      0,
    ]);
  });
  it('빈 박스는 폴백', () => {
    expect(defaultLabelAnchorFromBox(new Box3())).toBe(LABEL_ANCHOR_FALLBACK);
  });
});

describe('planLabelAnchorFromBoxes', () => {
  it('타워크레인 — 지브 bbox 가 아니라 마스트(바닥 메쉬) 중심에 선다', () => {
    const mast = box([-4.5, -0.3, -5], [5.1, 51, 5]); // 중심 x 0.3
    const top = box([-20.5, 16.3, -1.8], [52.1, 52.7, 3.2]); // 중심 x 15.8
    const [x, y, z] = planLabelAnchorFromBoxes([mast, top]);
    expect(x).toBeCloseTo(0.3, 9);
    expect(z).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(52.7 + LABEL_ANCHOR_TOP_PADDING, 9);
  });

  it('바닥 판정은 전체 높이의 비율 — 경계 정확값은 바닥, 넘으면 아님', () => {
    const base = box([0, 0, 0], [10, 1, 10]); // 중심 5
    const onEdge = box([20, 10, 20], [22, 50, 22]); // min.y = 10 = 100×0.1
    const above = box([40, 10.01, 40], [42, 100, 42]);
    // 높이 100(0~100): 문턱 10.
    expect(planLabelAnchorFromBoxes([base, onEdge, above])[0]).toBeCloseTo(
      (0 + 22) / 2,
      9,
    );
    expect(planLabelAnchorFromBoxes([base, onEdge, above])[2]).toBeCloseTo(
      11,
      9,
    );
  });

  it('단일 메쉬는 기본 앵커와 같다', () => {
    const b = box([-2, 0, -4], [6, 10, 4]);
    expect(planLabelAnchorFromBoxes([b])).toEqual(defaultLabelAnchorFromBox(b));
  });

  it('빈 박스는 건너뛰고, 전부 비면 폴백', () => {
    const b = box([0, 0, 0], [2, 2, 2]);
    expect(planLabelAnchorFromBoxes([new Box3(), b])).toEqual(
      planLabelAnchorFromBoxes([b]),
    );
    expect(planLabelAnchorFromBoxes([])).toBe(LABEL_ANCHOR_FALLBACK);
    expect(planLabelAnchorFromBoxes([new Box3()])).toBe(LABEL_ANCHOR_FALLBACK);
  });

  it('높이 0(납작한 모델)도 바닥으로 잡는다', () => {
    const flat = box([0, 3, 0], [4, 3, 4]);
    expect(planLabelAnchorFromBoxes([flat])).toEqual([
      2,
      3 + LABEL_ANCHOR_TOP_PADDING,
      2,
    ]);
  });
});
