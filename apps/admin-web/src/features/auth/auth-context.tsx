import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { clearToken, getToken, setToken as persistToken } from '../../lib/auth-token';
import type { AdminRole } from '../../types/domain';

interface AdminJwtPayload {
  sub: string;
  role: AdminRole;
}

interface AuthContextValue {
  role: AdminRole | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeRole(token: string): AdminRole | null {
  try {
    return jwtDecode<AdminJwtPayload>(token).role;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AdminRole | null>(() => {
    const token = getToken();
    return token ? decodeRole(token) : null;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      isAuthenticated: role !== null,
      login: (token: string) => {
        persistToken(token);
        setRole(decodeRole(token));
      },
      logout: () => {
        clearToken();
        setRole(null);
      },
    }),
    [role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
