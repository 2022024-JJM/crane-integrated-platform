import { describe, expect, it } from 'vitest';
import { createMemoryBlobStore } from '../asset-blob-store';

describe('createMemoryBlobStore', () => {
  it('넣은 것을 돌려주고 같은 키는 덮어쓴다', async () => {
    const store = createMemoryBlobStore();
    const first = new Blob(['a']);
    const second = new Blob(['bb']);
    await store.put('files/a/v1/a.glb', first);
    expect(await store.get('files/a/v1/a.glb')).toBe(first);
    await store.put('files/a/v1/a.glb', second);
    expect(await store.get('files/a/v1/a.glb')).toBe(second);
    expect(await store.keys()).toEqual(['files/a/v1/a.glb']);
  });

  it('없는 키는 null, 없는 키 삭제는 조용히 지나간다', async () => {
    const store = createMemoryBlobStore();
    expect(await store.get('missing')).toBeNull();
    await expect(store.delete('missing')).resolves.toBeUndefined();
    expect(await store.keys()).toEqual([]);
  });

  it('저장소끼리 서로 섞이지 않는다', async () => {
    const a = createMemoryBlobStore();
    const b = createMemoryBlobStore();
    await a.put('k', new Blob(['x']));
    expect(await b.get('k')).toBeNull();
  });
});
