import { beforeEach, describe, expect, it } from 'vitest';
import { useSceneSplitStore } from '../use-scene-split-store';

describe('useSceneSplitStore', () => {
  beforeEach(() => {
    useSceneSplitStore.setState({ activeKey: null });
  });

  it('enter 로 켜고 exit 로 끈다', () => {
    useSceneSplitStore.getState().enter('dock-1');
    expect(useSceneSplitStore.getState().activeKey).toBe('dock-1');
    useSceneSplitStore.getState().exit();
    expect(useSceneSplitStore.getState().activeKey).toBeNull();
  });

  it('같은 키 재진입·이미 꺼진 상태의 exit 는 상태 참조를 유지한다', () => {
    useSceneSplitStore.getState().enter('dock-1');
    const before = useSceneSplitStore.getState();
    useSceneSplitStore.getState().enter('dock-1');
    expect(useSceneSplitStore.getState()).toBe(before);
    useSceneSplitStore.getState().exit();
    const off = useSceneSplitStore.getState();
    useSceneSplitStore.getState().exit();
    expect(useSceneSplitStore.getState()).toBe(off);
  });

  it('다른 키로 enter 하면 그 키로 바뀐다 (한 번에 한 캔버스)', () => {
    useSceneSplitStore.getState().enter('dock-1');
    useSceneSplitStore.getState().enter('dock-2');
    expect(useSceneSplitStore.getState().activeKey).toBe('dock-2');
  });

  it('clear 는 자기 키일 때만 끈다 — 다른 캔버스의 분할은 건드리지 않는다', () => {
    useSceneSplitStore.getState().enter('dock-1');
    useSceneSplitStore.getState().clear('dock-2');
    expect(useSceneSplitStore.getState().activeKey).toBe('dock-1');
    useSceneSplitStore.getState().clear('dock-1');
    expect(useSceneSplitStore.getState().activeKey).toBeNull();
  });
});
