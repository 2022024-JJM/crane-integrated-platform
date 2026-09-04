import { describe, expect, it } from 'vitest';
import { MathUtils, Object3D, Quaternion, Vector3 } from 'three';
import {
  getContinuousTransformVectors,
  getObjectTransformVectors,
} from '../transform-vectors';

function makeObject(rotationDeg: [number, number, number]): Object3D {
  const obj = new Object3D();
  obj.rotation.set(
    MathUtils.degToRad(rotationDeg[0]),
    MathUtils.degToRad(rotationDeg[1]),
    MathUtils.degToRad(rotationDeg[2]),
  );
  return obj;
}

describe('getObjectTransformVectors (특성화)', () => {
  it('position/rotation/scale을 3자리 반올림으로 읽는다', () => {
    const obj = new Object3D();
    obj.position.set(1.23456, -2.34567, 0);
    obj.scale.set(1.99999, 1, 0.5);
    obj.rotation.set(0, MathUtils.degToRad(45), 0);

    const vectors = getObjectTransformVectors(obj);
    expect(vectors.position).toEqual([1.235, -2.346, 0]);
    expect(vectors.scale).toEqual([2, 1, 0.5]);
    expect(vectors.rotation).toEqual([0, 45, 0]);
  });

  it('y>90 자세는 three의 플립된 euler 표현을 그대로 낸다 (raw 동작 고정)', () => {
    // 자세 (0,85,0)에서 y축으로 +10° 회전 → 실제 y=95
    const obj = makeObject([0, 85, 0]);
    const delta = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      MathUtils.degToRad(10),
    );
    obj.quaternion.premultiply(delta);

    const raw = getObjectTransformVectors(obj);
    expect(raw.rotation[0]).toBeCloseTo(-180, 3);
    expect(raw.rotation[1]).toBeCloseTo(85, 3);
    expect(raw.rotation[2]).toBeCloseTo(-180, 3);
  });
});

describe('getContinuousTransformVectors', () => {
  it('드래그 시작 euler를 기준으로 플립을 연속 표현으로 되돌린다', () => {
    const obj = makeObject([0, 85, 0]);
    const delta = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      MathUtils.degToRad(10),
    );
    obj.quaternion.premultiply(delta);

    const resolved = getContinuousTransformVectors(obj, [0, 85, 0]);
    expect(resolved.rotation[0]).toBeCloseTo(0, 3);
    expect(resolved.rotation[1]).toBeCloseTo(95, 3);
    expect(resolved.rotation[2]).toBeCloseTo(0, 3);
  });

  it('prev가 없으면 raw 추출과 동일하다', () => {
    const obj = makeObject([0, 85, 0]);
    expect(getContinuousTransformVectors(obj, undefined)).toEqual(
      getObjectTransformVectors(obj),
    );
  });

  it('플립이 없으면 rotation이 raw와 같다 (항등)', () => {
    const obj = makeObject([10, 20, 30]);
    const resolved = getContinuousTransformVectors(obj, [10, 20, 30]);
    expect(resolved.rotation).toEqual(getObjectTransformVectors(obj).rotation);
  });

  it('position/scale은 보정과 무관하게 그대로다', () => {
    const obj = makeObject([0, 85, 0]);
    obj.position.set(1, 2, 3);
    obj.scale.set(2, 2, 2);
    const resolved = getContinuousTransformVectors(obj, [0, 85, 0]);
    expect(resolved.position).toEqual([1, 2, 3]);
    expect(resolved.scale).toEqual([2, 2, 2]);
  });

  // 스냅 경로(use-scene-transform readSnappedTransform)는 격자로 옮긴 deg 를
  // object.rotation.set 으로 되써 넣고 다음 프레임에 다시 읽는다 — 되쓴 값이
  // 그대로 돌아와야 스냅이 프레임마다 흔들리지 않는다.
  it('격자로 되쓴 rotation 을 다음 읽기에서 그대로 돌려준다 (yaw>90 플립 포함)', () => {
    for (const snapped of [
      [0, 30, 0],
      [0, 360, 0],
      [0, 105, 0],
      [15, 90, -45],
    ] as const) {
      const obj = makeObject([snapped[0], snapped[1], snapped[2]]);
      const resolved = getContinuousTransformVectors(obj, [
        snapped[0],
        snapped[1],
        snapped[2],
      ]);
      expect(resolved.rotation[0]).toBeCloseTo(snapped[0], 3);
      expect(resolved.rotation[1]).toBeCloseTo(snapped[1], 3);
      expect(resolved.rotation[2]).toBeCloseTo(snapped[2], 3);
    }
  });
});
