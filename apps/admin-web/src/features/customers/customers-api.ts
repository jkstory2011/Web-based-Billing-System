import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { Customer, CustomerType } from '../../types/domain';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/admin/customers'),
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
