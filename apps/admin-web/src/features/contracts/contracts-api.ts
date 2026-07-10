import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { AdhocCharge, Contract, ContractRecurringItem, RecurringPeriod } from '../../types/domain';

export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: () => apiRequest<Contract[]>('/admin/contracts'),
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ['contracts', id],
    queryFn: () => apiRequest<Contract>(`/admin/contracts/${id}`),
  });
}

export interface CreateContractInput {
  customerId: string;
  startDate: string;
  endDate?: string;
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContractInput) =>
      apiRequest<Contract>('/admin/contracts', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  });
}

export interface RecurringItemInput {
  description: string;
  period: RecurringPeriod;
  amount: number;
  startDate: string;
  endDate?: string;
}

export function useAddRecurringItem(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecurringItemInput) =>
      apiRequest<ContractRecurringItem>(`/admin/contracts/${contractId}/recurring-items`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (item) => {
      // Merge the created item into the cached detail directly instead of only
      // invalidating: an invalidate-triggered refetch would re-request
      // GET /admin/contracts/:id, and until the server-side read model catches up
      // that can still return the pre-add state, making the new item briefly (or,
      // under a static-response mock in tests, permanently) disappear from the UI.
      queryClient.setQueryData<Contract>(['contracts', contractId], (old) =>
        old ? { ...old, recurringItems: [...old.recurringItems, item] } : old,
      );
      queryClient.invalidateQueries({ queryKey: ['contracts'], exact: true });
    },
  });
}

export interface AdhocChargeInput {
  description: string;
  amount: number;
  occurredOn: string;
}

export function useAddAdhocCharge(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdhocChargeInput) =>
      apiRequest<AdhocCharge>(`/admin/contracts/${contractId}/adhoc-charges`, { method: 'POST', body: input }),
    onSuccess: (charge) => {
      // Same reasoning as useAddRecurringItem: merge directly rather than relying
      // solely on a refetch of the detail query.
      queryClient.setQueryData<Contract>(['contracts', contractId], (old) =>
        old ? { ...old, adhocCharges: [...old.adhocCharges, charge] } : old,
      );
      queryClient.invalidateQueries({ queryKey: ['contracts'], exact: true });
    },
  });
}
