import { type ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth/auth-context';
import { setToken } from '../lib/auth-token';

export function renderWithProviders(ui: ReactElement, options: { token?: string; route?: string } = {}) {
  if (options.token) {
    setToken(options.token);
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[options.route ?? '/']}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{ui}</AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// header {"alg":"none"}, payload {"sub":"portal-user-1","customerId":"customer-1"}, no signature
export const PORTAL_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJwb3J0YWwtdXNlci0xIiwiY3VzdG9tZXJJZCI6ImN1c3RvbWVyLTEifQ.';
