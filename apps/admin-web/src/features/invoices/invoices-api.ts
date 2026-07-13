import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, apiRequestBlob } from '../../lib/api-client';
import type { CollectionReminder, ContractInvoicePreview, Invoice, PaginatedResult, ReminderStage } from '../../types/domain';

export interface GeneratePeriodInput {
  periodStart: string;
  periodEnd: string;
}

export function usePreviewInvoices() {
  return useMutation({
    mutationFn: (input: GeneratePeriodInput) =>
      apiRequest<ContractInvoicePreview[]>('/admin/invoices/preview', { method: 'POST', body: input }),
  });
}

export function useGenerateInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GeneratePeriodInput) =>
      apiRequest<Invoice[]>('/admin/invoices/generate', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useInvoices(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiRequest<Invoice[]>('/admin/invoices'),
    enabled: options.enabled ?? true,
  });
}

export function useInvoicesPaginated(page: number, limit: number) {
  return useQuery({
    queryKey: ['invoices', 'paginated', page, limit],
    queryFn: () => apiRequest<PaginatedResult<Invoice>>(`/admin/invoices?page=${page}&limit=${limit}`),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => apiRequest<Invoice>(`/admin/invoices/${id}`),
  });
}

export function useIssueInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<Invoice>(`/admin/invoices/${id}/issue`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', id] });
    },
  });
}

export function useInvoiceReminders(id: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['invoices', id, 'reminders'],
    queryFn: () => apiRequest<CollectionReminder[]>(`/admin/invoices/${id}/reminders`),
    enabled: options.enabled ?? true,
  });
}

export function useSendOverdueReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: ReminderStage }) =>
      apiRequest<void>(`/admin/invoices/${id}/remind`, { method: 'POST', body: { stage } }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', variables.id, 'reminders'] });
    },
  });
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async (id: string) => {
      const blob = await apiRequestBlob(`/admin/invoices/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}
