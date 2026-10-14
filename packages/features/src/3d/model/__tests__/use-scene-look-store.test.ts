// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { sceneLookUniforms } from '@crane/domain/3d';
import {
  SCENE_LOOK_STORAGE_KEY,
  readControlRoom,
  useSceneLookStore,
} from '../use-scene-look-store';

beforeEach(() => {
  localStorage.clear();
  useSceneLookStore.setState({ controlRoom: false });
  sceneLookUniforms.mute.value = 0;
});

describe('useSceneLookStore', () => {
  it('토글은 영속하고 머티리얼 무채색 유니폼을 민다', () => {
    useSceneLookStore.getState().toggleControlRoom();
    expect(useSceneLookStore.getState().controlRoom).toBe(true);
    expect(localStorage.getItem(SCENE_LOOK_STORAGE_KEY)).toBe('1');
    expect(sceneLookUniforms.mute.value).toBe(1);
    expect(sceneLookUniforms.muteEquipment.value).toBeGreaterThan(0);
    expect(sceneLookUniforms.muteEquipment.value).toBeLessThan(1);
    useSceneLookStore.getState().toggleControlRoom();
    expect(sceneLookUniforms.mute.value).toBe(0);
    expect(sceneLookUniforms.muteEquipment.value).toBe(0);
    expect(localStorage.getItem(SCENE_LOOK_STORAGE_KEY)).toBe('0');
  });
  it('같은 값 재설정은 상태 참조를 유지한다', () => {
    const before = useSceneLookStore.getState();
    before.setControlRoom(false);
    expect(useSceneLookStore.getState()).toBe(before);
  });
  it('저장값이 없거나 깨졌으면 기본(끔)', () => {
    expect(readControlRoom()).toBe(false);
    localStorage.setItem(SCENE_LOOK_STORAGE_KEY, 'yes');
    expect(readControlRoom()).toBe(false);
    localStorage.setItem(SCENE_LOOK_STORAGE_KEY, '1');
    expect(readControlRoom()).toBe(true);
  });
});
