import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { CollectionNote, Customer, CustomerType, PaginatedResult } from '../../types/domain';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/admin/customers'),
  });
}

export function useCustomersPaginated(page: number, limit: number) {
  return useQuery({
    queryKey: ['customers', 'paginated', page, limit],
    queryFn: () => apiRequest<PaginatedResult<Customer>>(`/admin/customers?page=${page}&limit=${limit}`),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => apiRequest<Customer>(`/admin/customers/${id}`),
  });
}

export interface CustomerInput {
  type: CustomerType;
  name: string;
  businessRegNo?: string;
  email: string;
  phone?: string;
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInput) => apiRequest<Customer>('/admin/customers', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CustomerInput>) =>
      apiRequest<Customer>(`/admin/customers/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', id] });
    },
  });
}

export function useCreatePortalAccount(customerId: string) {
  return useMutation({
    mutationFn: () =>
      apiRequest<{ email: string; temporaryPassword: string }>(`/admin/customers/${customerId}/portal-account`, {
        method: 'POST',
      }),
  });
}

export function useSetCollectionOwner(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (adminUserId: string | null) =>
      apiRequest<Customer>(`/admin/customers/${customerId}/collection-owner`, { method: 'PATCH', body: { adminUserId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', customerId] }),
  });
}

export function useSetAutoReminderOverride(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (autoReminderOverride: boolean | null) =>
      apiRequest<Customer>(`/admin/customers/${customerId}/auto-reminder-override`, {
        method: 'PATCH',
        body: { autoReminderOverride },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', customerId] }),
  });
}

export function useCollectionNotes(customerId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['customers', customerId, 'collection-notes'],
    queryFn: () => apiRequest<CollectionNote[]>(`/admin/customers/${customerId}/collection-notes`),
    enabled: options.enabled ?? true,
  });
}

export function useCreateCollectionNote(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; invoiceId?: string }) =>
      apiRequest<CollectionNote>(`/admin/customers/${customerId}/collection-notes`, { method: 'POST', body: input }),
    // Append the created note straight into the cache instead of
    // invalidating: the same static-response-mock hazard documented on
    // useUpdateSettings above applies here — an invalidate-triggered
    // refetch of GET .../collection-notes would just re-request the list
    // and, under a static mock, silently drop the note this mutation just
    // created.
    onSuccess: (note) =>
      queryClient.setQueryData<CollectionNote[]>(['customers', customerId, 'collection-notes'], (prev) => [
        ...(prev ?? []),
        note,
      ]),
  });
}
