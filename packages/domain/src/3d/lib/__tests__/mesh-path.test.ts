import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import {
  findMeshByPath,
  getMeshPath,
  isMeshId,
  makeMeshId,
  parseMeshId,
} from '../mesh-path';

function named(name: string): Object3D {
  const node = new Object3D();
  node.name = name;
  return node;
}

/**
 * root
 * ├─ [0]Armature
 * │   ├─ [0]Spine
 * │   └─ [1]Hand.L
 * └─ [1](이름 없음)
 */
function buildTree() {
  const root = named('root');
  const armature = named('Armature');
  const spine = named('Spine');
  const hand = named('Hand.L');
  const anonymous = new Object3D();
  armature.add(spine, hand);
  root.add(armature, anonymous);
  return { root, armature, spine, hand, anonymous };
}

describe('makeMeshId / parseMeshId / isMeshId', () => {
  it('`modelId::meshPath` 형식으로 만들고 되돌린다', () => {
    const id = makeMeshId('model-1', '[0]Armature/[1]Hand.L');
    expect(id).toBe('model-1::[0]Armature/[1]Hand.L');
    expect(parseMeshId(id)).toEqual({
      modelId: 'model-1',
      meshPath: '[0]Armature/[1]Hand.L',
    });
    expect(isMeshId(id)).toBe(true);
  });

  it('meshPath 안의 `::`는 첫 구분자만 기준으로 보존된다', () => {
    const parsed = parseMeshId('m::a::b');
    expect(parsed).toEqual({ modelId: 'm', meshPath: 'a::b' });
  });

  it('구분자가 없으면 mesh id가 아니다', () => {
    expect(parseMeshId('model-1')).toBeNull();
    expect(isMeshId('model-1')).toBe(false);
  });

  it('빈 meshPath(루트)도 왕복된다', () => {
    expect(parseMeshId(makeMeshId('m', ''))).toEqual({
      modelId: 'm',
      meshPath: '',
    });
  });
});

describe('getMeshPath', () => {
  it('root 자신은 빈 경로', () => {
    const { root } = buildTree();
    expect(getMeshPath(root, root)).toBe('');
  });

  it('sibling index + 이름으로 경로를 만든다', () => {
    const { root, hand, anonymous } = buildTree();
    expect(getMeshPath(root, hand)).toBe('[0]Armature/[1]Hand.L');
    expect(getMeshPath(root, anonymous)).toBe('[1]');
  });

  it('root의 자손이 아니면 null', () => {
    const { root } = buildTree();
    expect(getMeshPath(root, named('stranger'))).toBeNull();
  });
});

describe('findMeshByPath', () => {
  it('getMeshPath 결과로 같은 노드를 되찾는다 (왕복)', () => {
    const { root, spine, hand, anonymous } = buildTree();
    for (const target of [spine, hand, anonymous]) {
      const path = getMeshPath(root, target);
      expect(path).not.toBeNull();
      expect(findMeshByPath(root, path as string)).toBe(target);
    }
  });

  it('빈 경로는 root를 돌려준다', () => {
    const { root } = buildTree();
    expect(findMeshByPath(root, '')).toBe(root);
  });

  it('index가 어긋나면 null (stale override silent skip)', () => {
    const { root } = buildTree();
    expect(findMeshByPath(root, '[5]Armature')).toBeNull();
  });

  it('index는 맞아도 이름이 다르면 null', () => {
    const { root } = buildTree();
    expect(findMeshByPath(root, '[0]Renamed')).toBeNull();
  });

  it('세그먼트 형식이 아니면 null', () => {
    const { root } = buildTree();
    expect(findMeshByPath(root, 'Armature')).toBeNull();
  });
});
