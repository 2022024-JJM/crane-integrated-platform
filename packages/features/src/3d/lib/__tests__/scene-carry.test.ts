import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import {
  cableLength,
  computeCableSegment,
  computeHookAnchor,
  isAttachOn,
  measureHookNode,
  pickNearestCandidate,
  type HookNodeExtent,
} from '../scene-carry';

function extent(): HookNodeExtent {
  return { origin: new Vector3(), top: 0, bottom: 0 };
}

/** 트롤리(부모) 아래 훅 블록(2 unit 높이 박스) — 노드 원점은 박스 위 1 unit. */
function hookRig() {
  const trolley = new Group();
  trolley.position.set(10, 60, 5);
  const node = new Group();
  node.position.set(0, -20, 0);
  const block = new Mesh(new BoxGeometry(2, 2, 2));
  block.position.set(0, -2, 0);
  node.add(block);
  trolley.add(node);
  trolley.updateMatrixWorld(true);
  return { trolley, node };
}

describe('isAttachOn', () => {
  it('0.5 이상만 켜짐, undefined·NaN 은 꺼짐', () => {
    expect(isAttachOn(1)).toBe(true);
    expect(isAttachOn(0.5)).toBe(true);
    expect(isAttachOn(0.49)).toBe(false);
    expect(isAttachOn(0)).toBe(false);
    expect(isAttachOn(undefined)).toBe(false);
    expect(isAttachOn(Number.NaN)).toBe(false);
  });
});

describe('measureHookNode', () => {
  it('노드 서브트리의 월드 위·아래 y 와 원점을 잰다', () => {
    const { node } = hookRig();
    const out = extent();
    measureHookNode(node, out);
    expect(out.origin.toArray()).toEqual([10, 40, 5]);
    expect(out.top).toBeCloseTo(39);
    expect(out.bottom).toBeCloseTo(37);
  });

  it('지오메트리가 없는 Empty 는 원점이 곧 위·아래', () => {
    const node = new Group();
    node.position.set(1, 2, 3);
    node.updateMatrixWorld(true);
    const out = extent();
    measureHookNode(node, out);
    expect(out.top).toBe(2);
    expect(out.bottom).toBe(2);
  });

  it('부모가 이 프레임에 움직였어도(matrixWorld 미갱신) 현재 자세로 잰다', () => {
    const { trolley, node } = hookRig();
    trolley.position.y = 50; // updateMatrixWorld 를 부르지 않는다
    const out = extent();
    measureHookNode(node, out);
    expect(out.origin.y).toBe(30);
    expect(out.bottom).toBeCloseTo(27);
  });
});

describe('computeHookAnchor', () => {
  it('XZ 는 평균, y 는 가장 낮은 바닥 + 오프셋', () => {
    const a = extent();
    a.origin.set(0, 50, 10);
    a.bottom = 45;
    const b = extent();
    b.origin.set(4, 50, -10);
    b.bottom = 44;
    const out = computeHookAnchor([a, b], -1, new Vector3());
    expect(out.toArray()).toEqual([2, 43, 0]);
  });

  it('노드가 없으면 원점', () => {
    expect(computeHookAnchor([], 5, new Vector3(1, 1, 1)).toArray()).toEqual([
      0, 0, 0,
    ]);
  });
});

describe('pickNearestCandidate', () => {
  const anchor = new Vector3(0, 100, 0);
  const near = { id: 'near', position: new Vector3(3, 0, 4) }; // 5
  const far = { id: 'far', position: new Vector3(0, 0, 11) }; // 11
  const edge = { id: 'edge', position: new Vector3(10, 0, 0) }; // 10

  it('반경 안에서 가장 가까운 것, 높이는 무시', () => {
    expect(pickNearestCandidate(anchor, [far, near], 10)).toBe(near);
  });

  it('반경 경계 정확값은 포함, 그 밖은 제외', () => {
    expect(pickNearestCandidate(anchor, [edge], 10)).toBe(edge);
    expect(pickNearestCandidate(anchor, [edge], 9.999)).toBeNull();
  });

  it('후보가 없거나 반경이 0·음수·NaN 이면 null', () => {
    expect(pickNearestCandidate(anchor, [], 10)).toBeNull();
    expect(pickNearestCandidate(anchor, [near], 0)).toBeNull();
    expect(pickNearestCandidate(anchor, [near], -1)).toBeNull();
    expect(pickNearestCandidate(anchor, [near], Number.NaN)).toBeNull();
  });

  it('같은 거리면 앞 항목', () => {
    const a = { id: 'a', position: new Vector3(5, 0, 0) };
    const b = { id: 'b', position: new Vector3(-5, 0, 0) };
    expect(pickNearestCandidate(anchor, [a, b], 10)).toBe(a);
  });
});

describe('computeCableSegment / cableLength', () => {
  it('부모 높이에서 노드 꼭대기까지 수직선', () => {
    const { node } = hookRig();
    const e = extent();
    measureHookNode(node, e);
    const seg = computeCableSegment(node, e, {
      from: new Vector3(),
      to: new Vector3(),
    });
    expect(seg.from.toArray()).toEqual([10, 60, 5]);
    expect(seg.to.toArray()).toEqual([10, 39, 5]);
    expect(cableLength(seg)).toBeCloseTo(21);
  });

  it('부모가 없으면 길이 0', () => {
    const node = new Group();
    const e = extent();
    measureHookNode(node, e);
    const seg = computeCableSegment(node, e, {
      from: new Vector3(),
      to: new Vector3(),
    });
    expect(cableLength(seg)).toBe(0);
  });

  it('꼭대기가 부모보다 높으면 0 (음수 길이 없음)', () => {
    expect(
      cableLength({ from: new Vector3(0, 1, 0), to: new Vector3(0, 5, 0) }),
    ).toBe(0);
  });
});
