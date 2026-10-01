/**
 * 브라우저 안의 바이너리 저장소 — 서버가 없는 운영 환경에서 사용자가 올린
 * 파일(GLB·도면·썸네일)을 IndexedDB 에 둔다.
 *
 * 키는 배포 파일과 같은 상대 경로(`files/<id>/v<N>/<name>`)다. 서버가 생기면
 * 같은 키로 그대로 올릴 수 있다. 인터페이스로 분리한 이유는 테스트에서
 * 메모리 구현을 주입하고, IndexedDB 를 못 쓰는 환경(시크릿 창 등)에서도
 * 화면이 죽지 않게 하려는 것이다.
 */

export interface AssetBlobStore {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | null>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** 탭을 닫으면 사라지는 저장소 — 테스트와, IndexedDB 불가 환경의 폴백. */
export function createMemoryBlobStore(): AssetBlobStore {
  const blobs = new Map<string, Blob>();
  return {
    put: async (key, blob) => {
      blobs.set(key, blob);
    },
    get: async (key) => blobs.get(key) ?? null,
    delete: async (key) => {
      blobs.delete(key);
    },
    keys: async () => [...blobs.keys()],
  };
}

const DB_NAME = 'crane-asset-library';
const STORE_NAME = 'files';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked.'));
  });
}

function runRequest<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = run(transaction.objectStore(STORE_NAME));
        // 쓰기는 트랜잭션이 끝나야 디스크에 남는다 — request 성공이 아니라
        // 트랜잭션 완료를 기다린다.
        transaction.oncomplete = () => {
          database.close();
          resolve(request.result);
        };
        const fail = () => {
          database.close();
          reject(transaction.error ?? request.error);
        };
        transaction.onerror = fail;
        transaction.onabort = fail;
      }),
  );
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function createIndexedDbBlobStore(): AssetBlobStore {
  return {
    put: async (key, blob) => {
      await runRequest('readwrite', (store) => store.put(blob, key));
    },
    get: async (key) => {
      const value = await runRequest('readonly', (store) => store.get(key));
      return value instanceof Blob ? value : null;
    },
    delete: async (key) => {
      await runRequest('readwrite', (store) => store.delete(key));
    },
    keys: async () => {
      const keys = await runRequest('readonly', (store) => store.getAllKeys());
      return keys.filter((key): key is string => typeof key === 'string');
    },
  };
}
