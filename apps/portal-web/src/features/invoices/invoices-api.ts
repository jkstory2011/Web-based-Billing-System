import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, apiRequestBlob } from '../../lib/api-client';
import type { Invoice } from '../../types/domain';

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiRequest<Invoice[]>('/portal/invoices'),
  });
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async (id: string) => {
      const blob = await apiRequestBlob(`/portal/invoices/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}
