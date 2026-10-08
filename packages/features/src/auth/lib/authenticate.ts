import { isRoleAllowedInScope, scopeOfRole, type AuthScope } from './auth-scope';
import type { AppScope } from '@crane/core/config/app-scope';
import type { AuthUser, UserRole } from './types';

interface Credentials {
  id: string;
  password: string;
  role: UserRole;
}

const ACCOUNTS: Credentials[] = [
  { id: 'crane.philly', password: '1', role: 'philly' },
  { id: 'crane.ocean', password: '1', role: 'ocean' },
  { id: 'crane.MRO', password: '1', role: 'mro' },
  { id: 'crane.MRO2', password: '1', role: 'mro2' },
  { id: 'crane.HMI', password: '1', role: 'hmi' },
  { id: 'crane.HMI2', password: '1', role: 'hmi2' },
  { id: 'Indoorshop.IT', password: '1', role: 'indoorshop' },
  { id: 'Indoorshop.OT', password: '1', role: 'indoorshop-ot' },
  { id: 'Indoorshop.Keyin', password: '1', role: 'keyin' },
];

export type LoginResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: 'invalid' }
  /** 아이디 · 비밀번호는 맞지만 이 주소의 계정이 아님. accountScope 는 그 계정이 쓰는 범위 */
  | { ok: false; reason: 'scope-denied'; accountScope: AppScope };

export function authenticate(
  id: string,
  password: string,
  scope: AuthScope,
): LoginResult {
  // ID는 앞뒤 공백·대소문자 차이를 허용한다 (비밀번호는 정확히 일치해야 함)
  const normalized = id.trim().toLowerCase();
  const account = ACCOUNTS.find(
    (a) => a.id.toLowerCase() === normalized && a.password === password,
  );
  if (!account) return { ok: false, reason: 'invalid' };
  if (!isRoleAllowedInScope(account.role, scope)) {
    const accountScope = scopeOfRole(account.role);
    if (!accountScope) return { ok: false, reason: 'invalid' };
    return { ok: false, reason: 'scope-denied', accountScope };
  }
  return { ok: true, user: { id: account.id, role: account.role } };
}
