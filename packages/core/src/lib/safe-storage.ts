type StorageKind = 'local' | 'session';

function resolveStorage(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function warn(op: string, key: string, error: unknown) {
  console.warn(`[safe-storage] ${op} failed (key: ${key})`, error);
}

export function getStorageItem(
  key: string,
  kind: StorageKind = 'local',
): string | null {
  const storage = resolveStorage(kind);
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch (error) {
    warn('getItem', key, error);
    return null;
  }
}

export function setStorageItem(
  key: string,
  value: string,
  kind: StorageKind = 'local',
): boolean {
  const storage = resolveStorage(kind);
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    warn('setItem', key, error);
    return false;
  }
}

export function removeStorageItem(
  key: string,
  kind: StorageKind = 'local',
): boolean {
  const storage = resolveStorage(kind);
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    warn('removeItem', key, error);
    return false;
  }
}

export function getStorageJson<T = unknown>(
  key: string,
  kind: StorageKind = 'local',
): T | null {
  const raw = getStorageItem(key, kind);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    warn('parseJson', key, error);
    return null;
  }
}

export function setStorageJson(
  key: string,
  value: unknown,
  kind: StorageKind = 'local',
): boolean {
  try {
    return setStorageItem(key, JSON.stringify(value), kind);
  } catch (error) {
    warn('stringifyJson', key, error);
    return false;
  }
}
