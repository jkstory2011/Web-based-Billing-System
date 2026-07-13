import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { AdminUserSummary } from '../../types/domain';

export function useAdminUsers(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiRequest<AdminUserSummary[]>('/admin/admin-users'),
    enabled: options.enabled ?? true,
  });
}
