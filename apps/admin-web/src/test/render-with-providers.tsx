import { type ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth/auth-context';
import { setToken } from '../lib/auth-token';

export function renderWithProviders(
  ui: ReactElement,
  options: { token?: string; route?: string; queryClient?: QueryClient } = {},
) {
  if (options.token) {
    setToken(options.token);
  }
  const queryClient = options.queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <MemoryRouter initialEntries={[options.route ?? '/']}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{ui}</AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  // Exposed so tests can assert on query lifecycle (e.g. proving a query has
  // genuinely settled) instead of relying on synchronous DOM timing.
  return { ...result, queryClient };
}

// header {"alg":"none"}, payload {"sub":"admin-1","role":"<ROLE>"}, no signature
export const SALES_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbi0xIiwicm9sZSI6IlNBTEVTIn0.';
export const ACCOUNTING_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbi0xIiwicm9sZSI6IkFDQ09VTlRJTkcifQ.';
export const ADMIN_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbi0xIiwicm9sZSI6IkFETUlOIn0.';
