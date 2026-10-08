import { describe, expect, it } from 'vitest';
import {
  AUTH_STORAGE_KEY,
  SCOPE_ROLES,
  authStorageKey,
  isRoleAllowedInScope,
  readStoredUser,
  scopeOfRole,
  writeStoredUser,
  type StorageLike,
} from '../auth-scope';

function memoryStore(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  const store: StorageLike & { data: Map<string, string> } = {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
  return store;
}

const crane = JSON.stringify({ id: 'crane.ocean', role: 'ocean' });
const indoor = JSON.stringify({ id: 'Indoorshop.OT', role: 'indoorshop-ot' });

describe('isRoleAllowedInScope', () => {
  it('role 9개가 정확히 한 범위에만 속한다', () => {
    const all = [...SCOPE_ROLES.crane, ...SCOPE_ROLES.indoor];
    expect(all).toHaveLength(9);
    for (const role of all) {
      expect(
        isRoleAllowedInScope(role, 'crane') !== isRoleAllowedInScope(role, 'indoor'),
      ).toBe(true);
    }
  });

  it('범위를 나누지 않으면(null) 모두 허용', () => {
    expect(isRoleAllowedInScope('keyin', null)).toBe(true);
    expect(isRoleAllowedInScope('ocean', null)).toBe(true);
  });

  it('목록에 없는 role 은 어느 범위에도 없다', () => {
    expect(isRoleAllowedInScope('admin', 'crane')).toBe(false);
    expect(scopeOfRole('admin')).toBeNull();
  });
});

describe('authStorageKey', () => {
  it('범위별 키, 나누지 않으면 옛 키', () => {
    expect(authStorageKey('crane')).toBe('crane-auth-user:crane');
    expect(authStorageKey('indoor')).toBe('crane-auth-user:indoor');
    expect(authStorageKey(null)).toBe(AUTH_STORAGE_KEY);
  });
});

describe('readStoredUser', () => {
  it('저장소가 없으면 null', () => {
    expect(readStoredUser(null, 'crane')).toBeNull();
  });

  it('범위 키의 사용자를 읽는다', () => {
    const s = memoryStore({ 'crane-auth-user:indoor': indoor });
    expect(readStoredUser(s, 'indoor')).toEqual({
      id: 'Indoorshop.OT',
      role: 'indoorshop-ot',
    });
  });

  it('SC-04 · 같은 탭의 crane 세션은 indoor 에서 읽히지 않고, 지워지지도 않는다', () => {
    const s = memoryStore({ 'crane-auth-user:crane': crane });
    expect(readStoredUser(s, 'indoor')).toBeNull();
    expect(s.data.get('crane-auth-user:crane')).toBe(crane);
  });

  it('범위 키에 범위 밖 role 이 들어 있으면 null', () => {
    const s = memoryStore({ 'crane-auth-user:indoor': crane });
    expect(readStoredUser(s, 'indoor')).toBeNull();
  });

  it('옛 키의 사용자가 이 범위 소속이면 범위 키로 옮기고 옛 키를 지운다', () => {
    const s = memoryStore({ [AUTH_STORAGE_KEY]: crane });
    expect(readStoredUser(s, 'crane')?.id).toBe('crane.ocean');
    expect(s.data.get('crane-auth-user:crane')).toBe(crane);
    expect(s.data.has(AUTH_STORAGE_KEY)).toBe(false);
  });

  it('옛 키의 사용자가 다른 범위 소속이면 옛 키를 그대로 둔다', () => {
    const s = memoryStore({ [AUTH_STORAGE_KEY]: indoor });
    expect(readStoredUser(s, 'crane')).toBeNull();
    expect(s.data.get(AUTH_STORAGE_KEY)).toBe(indoor);
  });

  it('범위를 나누지 않으면 옛 키를 그대로 읽는다 (기존 동작)', () => {
    const s = memoryStore({ [AUTH_STORAGE_KEY]: indoor });
    expect(readStoredUser(s, null)?.role).toBe('indoorshop-ot');
    expect(s.data.get(AUTH_STORAGE_KEY)).toBe(indoor);
  });

  it.each([
    ['손상된 JSON', '{oops'],
    ['배열', '[]'],
    ['null 문자열', 'null'],
    ['id 누락', JSON.stringify({ role: 'ocean' })],
    ['role 타입 오염', JSON.stringify({ id: 'x', role: 1 })],
    ['모르는 role', JSON.stringify({ id: 'x', role: 'admin' })],
  ])('%s 이면 null', (_, raw) => {
    const s = memoryStore({ 'crane-auth-user:crane': raw });
    expect(readStoredUser(s, 'crane')).toBeNull();
  });

  it('저장소 접근이 던지면 null', () => {
    const s: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(readStoredUser(s, 'crane')).toBeNull();
  });
});

describe('writeStoredUser', () => {
  it('범위 키에 쓰고, null 이면 그 키만 지운다', () => {
    const s = memoryStore({ 'crane-auth-user:crane': crane });
    writeStoredUser(s, 'indoor', { id: 'Indoorshop.IT', role: 'indoorshop' });
    expect(readStoredUser(s, 'indoor')?.id).toBe('Indoorshop.IT');
    writeStoredUser(s, 'indoor', null);
    expect(s.data.has('crane-auth-user:indoor')).toBe(false);
    expect(s.data.get('crane-auth-user:crane')).toBe(crane);
  });

  it('저장소가 없거나 던져도 예외를 내지 않는다', () => {
    expect(() => writeStoredUser(null, 'crane', null)).not.toThrow();
    const s: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    expect(() =>
      writeStoredUser(s, 'crane', { id: 'a', role: 'ocean' }),
    ).not.toThrow();
  });
});
