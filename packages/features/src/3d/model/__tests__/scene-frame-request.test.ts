import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  registerSceneFrameRequester,
  requestSceneFrame,
  sceneFrameRequesterCount,
  unregisterSceneFrameRequester,
} from '../scene-frame-request';

describe('scene-frame-request', () => {
  const registered: Array<() => void> = [];
  afterEach(() => {
    for (const r of registered) unregisterSceneFrameRequester(r);
    registered.length = 0;
  });

  it('등록이 없으면 requestSceneFrame 은 no-op 이다', () => {
    expect(sceneFrameRequesterCount()).toBe(0);
    expect(() => requestSceneFrame()).not.toThrow();
  });

  it('등록된 모든 invalidate 를 한 번씩 부른다', () => {
    const a = vi.fn();
    const b = vi.fn();
    registerSceneFrameRequester(a);
    registerSceneFrameRequester(b);
    registered.push(a, b);
    requestSceneFrame();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('같은 함수를 두 번 등록해도 한 번만 불린다(Set)', () => {
    const a = vi.fn();
    registerSceneFrameRequester(a);
    registerSceneFrameRequester(a);
    registered.push(a);
    expect(sceneFrameRequesterCount()).toBe(1);
    requestSceneFrame();
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('해제 뒤에는 불리지 않고, 없는 함수 해제는 무해하다', () => {
    const a = vi.fn();
    registerSceneFrameRequester(a);
    unregisterSceneFrameRequester(a);
    unregisterSceneFrameRequester(a);
    requestSceneFrame();
    expect(a).not.toHaveBeenCalled();
    expect(sceneFrameRequesterCount()).toBe(0);
  });
});
