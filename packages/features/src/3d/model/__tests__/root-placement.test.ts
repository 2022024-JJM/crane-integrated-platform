import { afterEach, describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { rigLiveReadouts } from '../rig-live-readouts';
import { readRootPlacement, writeRootPlacement } from '../root-placement';

function readout(
  rootDeltas: Array<{
    channel: 'position' | 'rotation' | 'scale';
    axis: 'x' | 'y' | 'z';
    delta: number;
  }>,
) {
  rigLiveReadouts.set('m1', {
    unresolvedJoints: [],
    jointValues: new Map(),
    unresolvedMappings: [],
    mappingValues: new Map(),
    rootDeltas,
  });
}

afterEach(() => {
  rigLiveReadouts.clear();
});

describe('readRootPlacement / writeRootPlacement', () => {
  it('readout 이 없는 객체는 화면 자세를 그대로 복사한다(참조는 out)', () => {
    const node = new Object3D();
    node.position.set(1, 2, 3);
    node.rotation.set(0, 1, 0);
    const out = new Object3D();
    expect(readRootPlacement('nope', node, out)).toBe(out);
    expect(out.position.toArray()).toEqual([1, 2, 3]);
    expect(out.quaternion.angleTo(node.quaternion)).toBeLessThan(1e-12);
  });

  it('readout 의 rootDeltas 를 벗긴 배치 자세를 읽고, 다시 쓰면 화면 자세로 돌아온다(왕복)', () => {
    readout([
      { channel: 'position', axis: 'z', delta: 3 },
      { channel: 'rotation', axis: 'y', delta: 90 },
    ]);
    const node = new Object3D();
    node.position.set(10, 0, -2); // 배치 z=-5 + Δ 3
    node.rotation.set(0, Math.PI / 2, 0); // 배치 yaw 0 + Δ 90°
    const placement = new Object3D();
    readRootPlacement('m1', node, placement);
    expect(placement.position.z).toBeCloseTo(-5, 9);
    expect(placement.rotation.y).toBeCloseTo(0, 9);

    placement.position.x = 20; // 편집(스냅)
    writeRootPlacement('m1', node, placement);
    expect(
      node.position.toArray().map((v) => Math.round(v * 1e9) / 1e9),
    ).toEqual([20, 0, -2]);
    expect(node.rotation.y).toBeCloseTo(Math.PI / 2, 9);
  });

  it('빈 rootDeltas 는 복사와 같다', () => {
    readout([]);
    const node = new Object3D();
    node.position.set(4, 5, 6);
    const out = readRootPlacement('m1', node, new Object3D());
    expect(out.position.toArray()).toEqual([4, 5, 6]);
    out.position.x = 1;
    writeRootPlacement('m1', node, out);
    expect(node.position.x).toBe(1);
  });
});
