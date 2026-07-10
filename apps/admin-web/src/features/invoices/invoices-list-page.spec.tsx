import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN, SALES_TOKEN } from '../../test/render-with-providers';
import { InvoicesListPage } from './invoices-list-page';

const API_URL = import.meta.env.VITE_API_URL as string;

describe('InvoicesListPage', () => {
  it('renders invoices with their status', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices`, () =>
        HttpResponse.json([
          {
            id: 'invoice-1',
            contractId: 'contract-1',
            periodStart: '2026-07-01T00:00:00.000Z',
            periodEnd: '2026-07-31T00:00:00.000Z',
            dueDate: '2026-08-14T00:00:00.000Z',
            issueDate: null,
            status: 'DRAFT',
            totalAmount: '150000',
            contract: { customer: { name: '홍길동' } },
          },
        ]),
      ),
    );

    renderWithProviders(<InvoicesListPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.getByText('초안')).toBeInTheDocument();
  });

  it('blocks SALES users from the invoice list, even via direct navigation', () => {
    renderWithProviders(<InvoicesListPage />, { token: SALES_TOKEN });

    expect(screen.queryByText('청구서 목록')).not.toBeInTheDocument();
  });
});
