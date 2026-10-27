/**
 * mock 데이터 영속 — 서버가 붙기 전까지 브라우저 localStorage 에 도메인 배열을 통째로 둔다.
 * 각 mock 모듈이 배열을 등록하면 그 자리에서 복원(hydrate)하고, 이후 publish 마다
 * 전부 저장한다. 서버 연동 시 이 파일만 비우면 된다.
 */
export const PERSIST_PREFIX = 'crane-mro2:';

interface Entry {
  read: () => unknown;
  write: (value: unknown) => void;
}
const registry = new Map<string, Entry>();

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** 배열(또는 직렬화 가능한 값)을 등록하고, 저장본이 있으면 즉시 복원한다. */
export function registerPersisted<T>(
  key: string,
  read: () => T,
  write: (value: T) => void,
): void {
  registry.set(key, { read, write: write as (v: unknown) => void });
  const s = storage();
  if (!s) return;
  const raw = s.getItem(PERSIST_PREFIX + key);
  if (raw == null) return;
  try {
    write(JSON.parse(raw) as T);
  } catch {
    s.removeItem(PERSIST_PREFIX + key);
  }
}

/** 등록된 전부를 저장한다 — 도메인 이벤트 publish 뒤에 한 번. */
export function persistAll(): void {
  const s = storage();
  if (!s) return;
  for (const [key, e] of registry) {
    try {
      s.setItem(PERSIST_PREFIX + key, JSON.stringify(e.read()));
    } catch {
      /* 용량 초과 등 — 세션 내 동작은 유지 */
    }
  }
}

/** 저장본을 지운다(데모 초기화). 호출 뒤 새로고침해야 시드로 돌아간다. */
export function resetPersisted(): void {
  const s = storage();
  if (!s) return;
  for (const key of registry.keys()) s.removeItem(PERSIST_PREFIX + key);
}

/** 테스트용 */
export function persistedKeys(): string[] {
  return [...registry.keys()];
}

/** 배열을 제자리에서 통째로 바꾼다 — const 배열 참조를 쥔 곳이 그대로 보게 */
export function replaceArray<T>(target: T[], next: readonly T[]): void {
  target.splice(0, target.length, ...next);
}
