import {
  createContext,
  use,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthUser } from './types';
import {
  getSessionStore,
  readStoredUser,
  writeStoredUser,
  type AuthScope,
} from './auth-scope';
import { authenticate, type LoginResult } from './authenticate';

interface AuthContextValue {
  user: AuthUser | null;
  /** 이 주소의 범위. null = 범위를 나누지 않음 */
  scope: AuthScope;
  login: (id: string, password: string) => LoginResult;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  scope = null,
}: {
  children: ReactNode;
  scope?: AuthScope;
}) {
  const [user, setUser] = useState<AuthUser | null>(() =>
    readStoredUser(getSessionStore(), scope),
  );

  const login = useCallback(
    (id: string, password: string): LoginResult => {
      const result = authenticate(id, password, scope);
      if (result.ok) {
        writeStoredUser(getSessionStore(), scope, result.user);
        setUser(result.user);
      }
      return result;
    },
    [scope],
  );

  const logout = useCallback(() => {
    writeStoredUser(getSessionStore(), scope, null);
    try {
      localStorage.removeItem('site-type');
    } catch {
      // 무시
    }
    setUser(null);
  }, [scope]);

  const value = useMemo(
    () => ({ user, scope, login, logout }),
    [user, scope, login, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
