import { describe, expect, it } from 'vitest';
import type { SavedMapInfo, SavedModelInfo } from '../../model/types';
import { makeMeshId } from '../mesh-path';
import { resolveSceneNodeParent } from '../scene-node-parent';

function model(id: string): SavedModelInfo {
  return {
    id,
    equipName: id,
    path: `/models/${id}.glb`,
    opacity: 1,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

function map(id: string): SavedMapInfo {
  return { id, path: `/maps/${id}.glb` };
}

const scene = {
  models: [model('m1')],
  maps: [map('map1')],
};

describe('resolveSceneNodeParent', () => {
  it('모델의 안쪽 노드는 kind model 과 경로를 돌려준다', () => {
    expect(
      resolveSceneNodeParent(scene, makeMeshId('m1', '[0]Boom/[1]Hook')),
    ).toEqual({ kind: 'model', id: 'm1', meshPath: '[0]Boom/[1]Hook' });
  });

  it('지도의 안쪽 노드는 kind map 을 돌려준다', () => {
    expect(
      resolveSceneNodeParent(scene, makeMeshId('map1', '[0]Okpo_Building')),
    ).toEqual({ kind: 'map', id: 'map1', meshPath: '[0]Okpo_Building' });
  });

  it('부모가 씬에 없으면 null', () => {
    expect(resolveSceneNodeParent(scene, makeMeshId('gone', '[0]A'))).toBe(
      null,
    );
  });

  it('노드 id 형식이 아니면(객체 id 그대로) null', () => {
    expect(resolveSceneNodeParent(scene, 'm1')).toBeNull();
    expect(resolveSceneNodeParent(scene, 'map1')).toBeNull();
    expect(resolveSceneNodeParent(scene, '')).toBeNull();
  });

  it('경로가 빈 노드 id 도 부모만 있으면 해석한다(경로 검증은 하지 않는다)', () => {
    expect(resolveSceneNodeParent(scene, 'map1::')).toEqual({
      kind: 'map',
      id: 'map1',
      meshPath: '',
    });
  });

  it('구분자가 여럿이면 첫 구분자로만 나눈다', () => {
    expect(resolveSceneNodeParent(scene, 'map1::[0]A::B')).toEqual({
      kind: 'map',
      id: 'map1',
      meshPath: '[0]A::B',
    });
  });

  it('같은 id 가 모델·지도 양쪽에 있으면(손상 저장본) 모델을 먼저 본다', () => {
    const dup = { models: [model('x')], maps: [map('x')] };
    expect(resolveSceneNodeParent(dup, 'x::[0]A')?.kind).toBe('model');
  });

  it('maps·models 가 빠진 씬에서도 던지지 않는다', () => {
    const broken = {} as Parameters<typeof resolveSceneNodeParent>[0];
    expect(resolveSceneNodeParent(broken, 'm1::[0]A')).toBeNull();
  });
});
