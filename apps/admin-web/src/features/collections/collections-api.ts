import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { CustomerAgingSummary } from '../../types/domain';

export function useAgingReport() {
  return useQuery({
    queryKey: ['collections', 'aging'],
    queryFn: () => apiRequest<CustomerAgingSummary[]>('/admin/collections/aging'),
  });
}
