import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN, SALES_TOKEN } from '../../test/render-with-providers';
import { InvoicesListPage } from './invoices-list-page';

const API_URL = import.meta.env.VITE_API_URL as string;

function invoice(id: string, customerName: string, status = 'DRAFT') {
  return {
    id,
    contractId: 'contract-1',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-31T00:00:00.000Z',
    dueDate: '2026-08-14T00:00:00.000Z',
    issueDate: null,
    status,
    totalAmount: '150000',
    contract: { customer: { name: customerName } },
  };
}

describe('InvoicesListPage', () => {
  it('renders invoices with their status', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices`, () =>
        HttpResponse.json({ data: [invoice('invoice-1', '홍길동')], total: 1, page: 1, limit: 20 }),
      ),
    );

    renderWithProviders(<InvoicesListPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.getByText('초안')).toBeInTheDocument();
  });

  it('moves to the next page and fetches it', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        if (page === '2') {
          return HttpResponse.json({ data: [invoice('invoice-2', '김철수')], total: 21, page: 2, limit: 20 });
        }
        return HttpResponse.json({ data: [invoice('invoice-1', '홍길동')], total: 21, page: 1, limit: 20 });
      }),
    );

    renderWithProviders(<InvoicesListPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => expect(screen.getByText('김철수')).toBeInTheDocument());
    expect(screen.queryByText('홍길동')).not.toBeInTheDocument();
  });

  it('blocks SALES users from the invoice list, even via direct navigation', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices`, () =>
        HttpResponse.json({ data: [invoice('invoice-1', '홍길동')], total: 1, page: 1, limit: 20 }),
      ),
    );

    const { queryClient } = renderWithProviders(<InvoicesListPage />, { token: SALES_TOKEN });

    // Wait for the underlying query to genuinely settle. If this test only
    // asserted synchronously (before the query resolves), it would pass
    // trivially because of the page's `isLoading` gate, not because the role
    // guard fired — regardless of whether the guard exists at all.
    await waitFor(() =>
      expect(queryClient.getQueryState(['invoices', 'paginated', 1, 20])?.status).toBe('success'),
    );

    expect(screen.queryByText('청구서 목록')).not.toBeInTheDocument();
    expect(screen.queryByText('홍길동')).not.toBeInTheDocument();
  });
});
