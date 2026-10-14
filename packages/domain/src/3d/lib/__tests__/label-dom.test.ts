import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  isBehindCamera,
  labelBoxClass,
  labelToneDotClass,
  labelZIndex,
  projectToScreen,
} from '../label-dom';

function camera(): PerspectiveCamera {
  const c = new PerspectiveCamera(50, 2, 0.1, 1000);
  c.position.set(0, 0, 10);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  return c;
}

describe('projectToScreen', () => {
  it('시선 중앙의 점은 뷰포트 중앙, 왼쪽 위 원점', () => {
    const out = { x: 0, y: 0 };
    projectToScreen(new Vector3(0, 0, 0), camera(), 800, 400, out);
    expect(out.x).toBeCloseTo(400, 6);
    expect(out.y).toBeCloseTo(200, 6);
  });
  it('+x 는 오른쪽, +y 는 위(화면 y 감소)', () => {
    const out = { x: 0, y: 0 };
    projectToScreen(new Vector3(1, 1, 0), camera(), 800, 400, out);
    expect(out.x).toBeGreaterThan(400);
    expect(out.y).toBeLessThan(200);
  });
});

describe('isBehindCamera', () => {
  it('카메라 앞은 false, 뒤는 true', () => {
    const c = camera();
    expect(isBehindCamera(new Vector3(0, 0, 0), c)).toBe(false);
    expect(isBehindCamera(new Vector3(0, 0, 20), c)).toBe(true);
  });
});

describe('labelZIndex', () => {
  it('near 에서 range[0], far 에서 range[1], 사이는 선형(반올림)', () => {
    expect(labelZIndex(0.1, 0.1, 1000, [5, 0])).toBe(5);
    expect(labelZIndex(1000, 0.1, 1000, [5, 0])).toBe(0);
    expect(labelZIndex(500, 0.1, 1000, [5, 0])).toBe(3);
  });
  it('near ≥ far(퇴화)면 range[0]', () => {
    expect(labelZIndex(1, 5, 5, [5, 0])).toBe(5);
    expect(labelZIndex(1, 10, 5, [5, 0])).toBe(5);
  });
});

describe('labelBoxClass / labelToneDotClass', () => {
  it('emphasis 면 큰 글자·검은 테두리, 아니면 11px', () => {
    expect(labelBoxClass('running', null, false, false)).toContain(
      'text-[11px]',
    );
    expect(labelBoxClass('running', null, false, false, true)).toContain(
      'text-[13px]',
    );
    expect(labelBoxClass('running', null, false, false, true)).toContain(
      'ring-2',
    );
  });

  it('알람이 있으면 알람색이 상자를 차지하고 상태는 점으로 — unknown·offline 은 점 없음', () => {
    expect(labelBoxClass('running', 'critical', false, false)).toContain(
      'bg-red-600',
    );
    expect(labelBoxClass('running', 'critical', false, false)).not.toContain(
      '#3ab426',
    );
    expect(labelToneDotClass('running', 'critical')).toContain('#3ab426');
    expect(labelToneDotClass('unknown', 'critical')).toBeNull();
    expect(labelToneDotClass('offline', 'critical')).toBeNull();
    expect(labelToneDotClass('running', null)).toBeNull();
  });
  it('알람이 없으면 상태색, inert 면 포인터 차단, dimmed 는 흐림, 통신두절은 알람 없을 때만 흐림', () => {
    expect(labelBoxClass('fault', null, false, false)).toContain('#ff0000');
    expect(labelBoxClass('fault', null, false, false)).toContain(
      'pointer-events-auto cursor-pointer',
    );
    expect(labelBoxClass('fault', null, true, false)).toContain(
      'pointer-events-none',
    );
    expect(labelBoxClass('fault', null, false, true)).toContain('opacity-30');
    expect(labelBoxClass('offline', null, false, false)).toContain(
      'opacity-70',
    );
    expect(labelBoxClass('offline', 'info', false, false)).not.toContain(
      'opacity-70',
    );
  });
});
