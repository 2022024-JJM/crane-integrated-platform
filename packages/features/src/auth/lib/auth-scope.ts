import type { AppScope } from '@crane/core/config/app-scope';
import type { AuthUser, UserRole } from './types';

/**
 * 범위별 로그인 허용 role.
 * 여기 없는 role 은 범위를 나눴을 때 어느 주소에서도 로그인되지 않는다(닫힌 쪽이 기본).
 */
export const SCOPE_ROLES: Record<AppScope, readonly UserRole[]> = {
  crane: ['philly', 'ocean', 'goliath', 'mro', 'mro2', 'hmi', 'hmi2'],
  indoor: ['indoorshop', 'indoorshop-ot', 'keyin'],
};

/** 범위를 나누기 전부터 쓰던 세션 키. 범위를 나누지 않으면 그대로 쓴다. */
export const AUTH_STORAGE_KEY = 'crane-auth-user';

/** null = 범위를 나누지 않음(모든 role 허용) */
export type AuthScope = AppScope | null;

export function isRoleAllowedInScope(role: string, scope: AuthScope): boolean {
  if (scope === null) return true;
  return (SCOPE_ROLES[scope] as readonly string[]).includes(role);
}

/** role 이 속한 범위. 목록에 없는 role 이면 null. */
export function scopeOfRole(role: string): AppScope | null {
  if (isRoleAllowedInScope(role, 'crane')) return 'crane';
  if (isRoleAllowedInScope(role, 'indoor')) return 'indoor';
  return null;
}

export function authStorageKey(scope: AuthScope): string {
  return scope === null ? AUTH_STORAGE_KEY : `${AUTH_STORAGE_KEY}:${scope}`;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 세션 저장소. 막힌 환경(사생활 보호 창 등)이면 null. */
export function getSessionStore(): StorageLike | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function parseUser(raw: string | null, scope: AuthScope): AuthUser | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const { id, role } = value as { id?: unknown; role?: unknown };
    if (typeof id !== 'string' || typeof role !== 'string') return null;
    if (scopeOfRole(role) === null) return null;
    if (!isRoleAllowedInScope(role, scope)) return null;
    return { id, role: role as UserRole };
  } catch {
    return null;
  }
}

/**
 * 범위의 로그인 사용자. 범위 밖 role · 손상된 값은 null.
 * 범위를 나눈 뒤 처음 읽을 때, 옛 키(`crane-auth-user`)의 사용자가 이 범위 소속이면
 * 범위 키로 옮기고 옛 키를 지운다. 다른 범위 소속이면 옛 키를 그대로 둔다.
 */
export function readStoredUser(
  storage: StorageLike | null,
  scope: AuthScope,
): AuthUser | null {
  if (!storage) return null;
  try {
    const own = parseUser(storage.getItem(authStorageKey(scope)), scope);
    if (own || scope === null) return own;

    const legacyRaw = storage.getItem(AUTH_STORAGE_KEY);
    const legacy = parseUser(legacyRaw, scope);
    if (legacy && legacyRaw) {
      storage.setItem(authStorageKey(scope), legacyRaw);
      storage.removeItem(AUTH_STORAGE_KEY);
    }
    return legacy;
  } catch {
    return null;
  }
}

export function writeStoredUser(
  storage: StorageLike | null,
  scope: AuthScope,
  user: AuthUser | null,
): void {
  if (!storage) return;
  try {
    if (user) storage.setItem(authStorageKey(scope), JSON.stringify(user));
    else storage.removeItem(authStorageKey(scope));
  } catch {
    // 저장 실패는 무시 — 이번 탭의 메모리 상태로 계속 동작
  }
}
