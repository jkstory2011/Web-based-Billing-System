import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { ContractInvoicePreview, Invoice } from '../../types/domain';

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
