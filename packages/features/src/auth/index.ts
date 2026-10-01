export { AuthProvider, useAuth } from './lib/auth-context';
export {
  AUTH_STORAGE_KEY,
  SCOPE_ROLES,
  authStorageKey,
  getSessionStore,
  isRoleAllowedInScope,
  readStoredUser,
  type AuthScope,
} from './lib/auth-scope';
export type { LoginResult } from './lib/authenticate';
export type { AuthUser, UserRole } from './lib/types';
export { AuthSiteTypeSync } from './ui/auth-site-type-sync';
