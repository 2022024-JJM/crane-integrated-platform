import {
  createContext,
  use,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthUser, UserRole } from './types';

interface Credentials {
  id: string;
  password: string;
  role: UserRole;
}

const ACCOUNTS: Credentials[] = [
  { id: 'crane.philly', password: '1', role: 'philly' },
  { id: 'crane.ocean', password: '1', role: 'ocean' },
  { id: 'crane.goliath', password: '1', role: 'goliath' },
];

export const AUTH_STORAGE_KEY = 'crane-auth-user';

interface AuthContextValue {
  user: AuthUser | null;
  login: (id: string, password: string) => UserRole | false;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);

  const login = useCallback((id: string, password: string): UserRole | false => {
    const account = ACCOUNTS.find(
      (a) => a.id === id && a.password === password,
    );
    if (!account) return false;
    const authUser: AuthUser = { id: account.id, role: account.role };
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    setUser(authUser);
    return account.role;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('site-type');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, logout }),
    [user, login, logout],
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
