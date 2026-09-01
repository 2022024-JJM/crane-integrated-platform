import { beforeEach, describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { modelObjectRegistry, type SavedModelInfo } from '@crane/domain/3d';
import { useValueMapperStore } from '../use-value-mapper-store';

function mapObject(
  overrides: Partial<{
    id: string;
    type: 'PX' | 'PY' | 'PZ' | 'RX' | 'RY' | 'RZ' | 'SX' | 'SY' | 'SZ';
    scale: number;
    offset: number;
  }> = {},
) {
  return {
    id: 'obj-1',
    type: 'PX' as const,
    scale: 1,
    offset: 0,
    originTransform: {
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    },
    ...overrides,
  };
}

function model(overrides: Partial<SavedModelInfo> = {}): SavedModelInfo {
  return {
    id: 'obj-1',
    equipName: 'Crane',
    path: '/models/crane.glb',
    opacity: 1,
    position: [1, 2, 3],
    rotation: [0, 90, 0],
    scale: [1, 1, 1],
    valueMapList: [
      { type: 'PX', key: 'crane_1:X' },
      { type: 'RY', key: 'crane_1:ANG', scale: 0.1, offset: 5 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  useValueMapperStore.setState({ map: {} });
  modelObjectRegistry.clear();
});

describe('register / unregister', () => {
  it('같은 (id, type)은 중복 등록되지 않는다', () => {
    const { register } = useValueMapperStore.getState();
    register('k', mapObject());
    register('k', mapObject({ scale: 99 }));
    expect(useValueMapperStore.getState().map['k']).toHaveLength(1);

    register('k', mapObject({ type: 'PY' }));
    expect(useValueMapperStore.getState().map['k']).toHaveLength(2);
  });

  it('unregister는 해당 (id, type)만 지우고, 빈 배열이 되면 key를 제거한다', () => {
    const { register, unregister } = useValueMapperStore.getState();
    register('k', mapObject({ type: 'PX' }));
    register('k', mapObject({ type: 'PY' }));

    unregister('k', { id: 'obj-1', type: 'PX' });
    expect(useValueMapperStore.getState().map['k']).toHaveLength(1);

    unregister('k', { id: 'obj-1', type: 'PY' });
    expect(useValueMapperStore.getState().map).not.toHaveProperty('k');
  });

  it('없는 key/조합의 unregister는 상태를 바꾸지 않는다 (동일 참조)', () => {
    const { register, unregister } = useValueMapperStore.getState();
    register('k', mapObject());
    const before = useValueMapperStore.getState();
    unregister('missing', { id: 'obj-1', type: 'PX' });
    unregister('k', { id: 'other', type: 'PX' });
    expect(useValueMapperStore.getState()).toBe(before);
  });
});

describe('registerFromModel / unregisterFromModel', () => {
  it('valueMapList 항목마다 scale/offset 기본값(1/0)으로 등록한다', () => {
    useValueMapperStore.getState().registerFromModel(model());
    const { map } = useValueMapperStore.getState();

    expect(map['crane_1:X'][0]).toMatchObject({
      id: 'obj-1',
      type: 'PX',
      scale: 1,
      offset: 0,
    });
    expect(map['crane_1:ANG'][0]).toMatchObject({
      type: 'RY',
      scale: 0.1,
      offset: 5,
    });
    // originTransform의 rotation은 도 → 라디안으로 변환해 보관한다.
    expect(map['crane_1:X'][0].originTransform.rotation[1]).toBeCloseTo(
      Math.PI / 2,
      10,
    );
  });

  it('같은 모델을 두 번 등록해도 중복이 없다', () => {
    const { registerFromModel } = useValueMapperStore.getState();
    registerFromModel(model());
    registerFromModel(model());
    expect(useValueMapperStore.getState().map['crane_1:X']).toHaveLength(1);
  });

  it('unregisterFromModel은 그 모델의 매핑을 전부 지운다', () => {
    const { registerFromModel, unregisterFromModel } =
      useValueMapperStore.getState();
    registerFromModel(model());
    registerFromModel(model({ id: 'obj-2' }));

    unregisterFromModel(model());
    const { map } = useValueMapperStore.getState();
    expect(map['crane_1:X']).toHaveLength(1);
    expect(map['crane_1:X'][0].id).toBe('obj-2');
  });
});

describe('applyValue', () => {
  it('world = offset + value * scale (반올림 3자리) — 위치 축', () => {
    const object = new Object3D();
    modelObjectRegistry.register('obj-1', object);
    const { register, applyValue } = useValueMapperStore.getState();
    register('k', mapObject({ type: 'PX', scale: 0.1, offset: 5 }));

    applyValue('k', 12.345);
    // v = numRound(12.345 * 0.1) — float 곱이 1.2345000000000002라 1.235
    expect(object.position.x).toBeCloseTo(5 + 1.235, 10);
  });

  it('회전 축은 도 값으로 보고 라디안으로 변환한다 (offset 미적용)', () => {
    const object = new Object3D();
    modelObjectRegistry.register('obj-1', object);
    const { register, applyValue } = useValueMapperStore.getState();
    register('k', mapObject({ type: 'RY', offset: 99 }));

    applyValue('k', 90);
    expect(object.rotation.y).toBeCloseTo(Math.PI / 2, 10);
  });

  it('스케일 축은 값을 그대로 쓴다', () => {
    const object = new Object3D();
    modelObjectRegistry.register('obj-1', object);
    const { register, applyValue } = useValueMapperStore.getState();
    register('k', mapObject({ type: 'SZ', scale: 2 }));

    applyValue('k', 1.5);
    expect(object.scale.z).toBeCloseTo(3, 10);
  });

  it('registry에 없는 객체·없는 key는 조용히 무시한다', () => {
    const { register, applyValue } = useValueMapperStore.getState();
    register('k', mapObject());
    expect(() => {
      applyValue('k', 1);
      applyValue('missing', 1);
    }).not.toThrow();
  });
});

describe('resetToOrigin / clear', () => {
  it('resetToOrigin은 map을 유지한 채 객체만 원위치로 돌린다', () => {
    const object = new Object3D();
    modelObjectRegistry.register('obj-1', object);
    const { registerFromModel, applyValue, resetToOrigin } =
      useValueMapperStore.getState();
    registerFromModel(model());
    applyValue('crane_1:X', 100);
    expect(object.position.x).toBe(100);

    resetToOrigin();
    expect(object.position.x).toBe(1);
    expect(object.position.z).toBe(3);
    expect(object.rotation.y).toBeCloseTo(Math.PI / 2, 10);
    expect(useValueMapperStore.getState().map['crane_1:X']).toBeDefined();
  });

  it('clear는 원위치 복귀 후 map을 비운다', () => {
    const object = new Object3D();
    modelObjectRegistry.register('obj-1', object);
    const { registerFromModel, applyValue, clear } =
      useValueMapperStore.getState();
    registerFromModel(model());
    applyValue('crane_1:X', 100);

    clear();
    expect(object.position.x).toBe(1);
    expect(useValueMapperStore.getState().map).toEqual({});
  });
});
