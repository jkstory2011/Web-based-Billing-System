import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { SystemSettings } from '../../types/domain';

export function useSettings(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiRequest<SystemSettings>('/admin/settings'),
    enabled: options.enabled ?? true,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SystemSettings) => apiRequest<SystemSettings>('/admin/settings', { method: 'PATCH', body: input }),
    // Write the mutation response straight into the cache instead of
    // invalidating: the only query keyed on 'settings' is the one this
    // mutation just updated, so an invalidate-triggered refetch would
    // immediately re-request GET /admin/settings and, until the server-side
    // read model catches up, could overwrite this response with the
    // pre-update state (permanently, under a static-response mock in tests).
    onSuccess: (data) => queryClient.setQueryData(['settings'], data),
  });
}
