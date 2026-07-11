import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api-client';

export function createAppQueryClient(onUnauthorized: () => void): QueryClient {
  const handleError = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      onUnauthorized();
    }
  };

  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleError,
    }),
    // TanStack Query v5 keeps query and mutation errors on separate caches;
    // both must trigger the same centralized 401 logout.
    mutationCache: new MutationCache({
      onError: handleError,
    }),
    defaultOptions: {
      queries: { retry: false },
    },
  });
}
