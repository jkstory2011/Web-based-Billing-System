import { useMemo, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './app/router';
import { createAppQueryClient } from './app/query-client';
import { AuthProvider, useAuth } from './features/auth/auth-context';

function QueryProvider({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const queryClient = useMemo(() => createAppQueryClient(logout), [logout]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function App() {
  return (
    <AuthProvider>
      <QueryProvider>
        <AppRouter />
      </QueryProvider>
    </AuthProvider>
  );
}
