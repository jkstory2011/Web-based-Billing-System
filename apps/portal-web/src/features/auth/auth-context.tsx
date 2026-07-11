import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { clearToken, getToken, setToken as persistToken } from '../../lib/auth-token';

interface PortalJwtPayload {
  sub: string;
  customerId: string;
}

interface AuthContextValue {
  customerId: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeCustomerId(token: string): string | null {
  try {
    return jwtDecode<PortalJwtPayload>(token).customerId;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customerId, setCustomerId] = useState<string | null>(() => {
    const token = getToken();
    return token ? decodeCustomerId(token) : null;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      customerId,
      isAuthenticated: customerId !== null,
      login: (token: string) => {
        persistToken(token);
        setCustomerId(decodeCustomerId(token));
      },
      logout: () => {
        clearToken();
        setCustomerId(null);
      },
    }),
    [customerId],
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
