import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import {
  TOP_VIEW_EQUIPMENT_MARGIN_M,
  TOP_VIEW_EQUIPMENT_MIN_SIZE_M,
  expandTopViewBounds,
} from '../top-view-focus';

describe('expandTopViewBounds', () => {
  it('빈 박스·null 은 null', () => {
    expect(expandTopViewBounds(null, 1)).toBeNull();
    expect(expandTopViewBounds(new Box3(), 1)).toBeNull();
  });

  it('XZ 에 여백을 두르고 y 는 그대로', () => {
    const b = new Box3(new Vector3(0, 0, 0), new Vector3(1000, 50, 1000));
    const out = expandTopViewBounds(b, 1)!;
    expect(out.min.x).toBe(-TOP_VIEW_EQUIPMENT_MARGIN_M);
    expect(out.max.z).toBe(1000 + TOP_VIEW_EQUIPMENT_MARGIN_M);
    expect(out.min.y).toBe(0);
    expect(out.max.y).toBe(50);
    expect(b.min.x).toBe(0); // 입력 불변
  });

  it('작은 범위는 최소 한 변으로 키우되 중심을 유지, m/unit 을 환산', () => {
    const b = new Box3(new Vector3(10, 0, 10), new Vector3(20, 0, 20));
    const out = expandTopViewBounds(b, 2)!;
    const size = out.getSize(new Vector3());
    expect(size.x).toBeCloseTo(TOP_VIEW_EQUIPMENT_MIN_SIZE_M / 2, 6);
    expect(size.z).toBeCloseTo(TOP_VIEW_EQUIPMENT_MIN_SIZE_M / 2, 6);
    expect(out.getCenter(new Vector3()).x).toBeCloseTo(15, 6);
  });

  it('한 변만 작으면 그 변만 키운다', () => {
    const b = new Box3(new Vector3(0, 0, 0), new Vector3(2000, 0, 10));
    const out = expandTopViewBounds(b, 1)!;
    const size = out.getSize(new Vector3());
    expect(size.x).toBe(2000 + 2 * TOP_VIEW_EQUIPMENT_MARGIN_M);
    expect(size.z).toBeCloseTo(2000 + 2 * TOP_VIEW_EQUIPMENT_MARGIN_M, 6);
  });
});
