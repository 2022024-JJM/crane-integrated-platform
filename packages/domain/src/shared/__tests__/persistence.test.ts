import { afterEach, describe, expect, it } from 'vitest';
import {
  PERSIST_PREFIX,
  persistAll,
  registerPersisted,
  replaceArray,
  resetPersisted,
} from '../persistence';

// node 환경 — localStorage 를 흉내 낸다
const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
} as unknown as Storage;
afterEach(() => {
  store.clear();
  // @ts-expect-error 테스트용 전역
  delete globalThis.localStorage;
});

describe('persistence', () => {
  it('등록 시 저장본이 있으면 복원하고, persistAll 로 저장, reset 으로 지운다', () => {
    // @ts-expect-error 테스트용 전역
    globalThis.localStorage = fakeStorage;
    store.set(PERSIST_PREFIX + 't1', JSON.stringify([{ id: 'x' }]));
    const arr: { id: string }[] = [{ id: 'seed' }];
    registerPersisted(
      't1',
      () => arr,
      (v: { id: string }[]) => replaceArray(arr, v),
    );
    expect(arr).toEqual([{ id: 'x' }]);
    arr.push({ id: 'y' });
    persistAll();
    expect(JSON.parse(store.get(PERSIST_PREFIX + 't1')!)).toHaveLength(2);
    resetPersisted();
    expect(store.has(PERSIST_PREFIX + 't1')).toBe(false);
  });
  it('깨진 저장본은 버리고 시드를 유지한다', () => {
    // @ts-expect-error 테스트용 전역
    globalThis.localStorage = fakeStorage;
    store.set(PERSIST_PREFIX + 't2', '{not json');
    const arr = [1, 2];
    registerPersisted(
      't2',
      () => arr,
      (v: number[]) => replaceArray(arr, v),
    );
    expect(arr).toEqual([1, 2]);
    expect(store.has(PERSIST_PREFIX + 't2')).toBe(false);
  });
});
