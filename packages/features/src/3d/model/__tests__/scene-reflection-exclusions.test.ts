import { Object3D } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearReflectionExclusions,
  excludeFromReflection,
  getReflectionExclusions,
} from '../scene-reflection-exclusions';

afterEach(() => {
  clearReflectionExclusions();
});

describe('scene-reflection-exclusions', () => {
  it('처음엔 비어 있다', () => {
    expect(getReflectionExclusions().size).toBe(0);
  });

  it('등록하면 집합에 들어가고 해제하면 빠진다', () => {
    const dome = new Object3D();
    const unregister = excludeFromReflection(dome);
    expect(getReflectionExclusions().has(dome)).toBe(true);
    expect(getReflectionExclusions().size).toBe(1);
    unregister();
    expect(getReflectionExclusions().has(dome)).toBe(false);
    expect(getReflectionExclusions().size).toBe(0);
  });

  it('같은 객체를 두 번 등록해도 하나다', () => {
    const dome = new Object3D();
    excludeFromReflection(dome);
    excludeFromReflection(dome);
    expect(getReflectionExclusions().size).toBe(1);
  });

  it('해제 함수를 두 번 불러도 무해하다', () => {
    const dome = new Object3D();
    const unregister = excludeFromReflection(dome);
    unregister();
    expect(() => unregister()).not.toThrow();
    expect(getReflectionExclusions().has(dome)).toBe(false);
  });

  it('한 객체의 해제는 다른 등록에 영향을 주지 않는다', () => {
    const dome = new Object3D();
    const sun = new Object3D();
    const unregisterDome = excludeFromReflection(dome);
    excludeFromReflection(sun);
    unregisterDome();
    expect(getReflectionExclusions().has(dome)).toBe(false);
    expect(getReflectionExclusions().has(sun)).toBe(true);
  });

  it('getReflectionExclusions 는 살아 있는 같은 집합을 돌려준다(참조 안정, 순회 가능)', () => {
    const view = getReflectionExclusions();
    const dome = new Object3D();
    excludeFromReflection(dome);
    expect(getReflectionExclusions()).toBe(view);
    expect([...view]).toEqual([dome]);
  });

  it('clearReflectionExclusions 는 전부 비운다', () => {
    excludeFromReflection(new Object3D());
    excludeFromReflection(new Object3D());
    clearReflectionExclusions();
    expect(getReflectionExclusions().size).toBe(0);
  });
});
