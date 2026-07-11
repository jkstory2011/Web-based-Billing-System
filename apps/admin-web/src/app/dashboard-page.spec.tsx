import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN, SALES_TOKEN } from '../test/render-with-providers';
import { DashboardPage } from './dashboard-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const invoices = [
  {
    id: 'invoice-a-jun',
    contractId: 'contract-a',
    periodStart: '2026-06-01T00:00:00.000Z',
    periodEnd: '2026-06-30T00:00:00.000Z',
    issueDate: '2026-06-01T00:00:00.000Z',
    dueDate: '2026-06-15T00:00:00.000Z',
    status: 'SENT',
    totalAmount: '100000',
    contract: { customer: { id: 'a', name: '고객A', email: 'a@example.com' } },
  },
  {
    id: 'invoice-a-jul',
    contractId: 'contract-a',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-31T00:00:00.000Z',
    issueDate: '2026-07-01T00:00:00.000Z',
    dueDate: '2026-07-15T00:00:00.000Z',
    status: 'SENT',
    totalAmount: '50000.5',
    contract: { customer: { id: 'a', name: '고객A', email: 'a@example.com' } },
  },
  {
    id: 'invoice-b-jul',
    contractId: 'contract-b',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-31T00:00:00.000Z',
    issueDate: '2026-07-01T00:00:00.000Z',
    dueDate: '2026-07-15T00:00:00.000Z',
    status: 'SENT',
    totalAmount: '200000',
    contract: { customer: { id: 'b', name: '고객B', email: 'b@example.com' } },
  },
  {
    id: 'invoice-c-draft',
    contractId: 'contract-c',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-31T00:00:00.000Z',
    issueDate: null,
    dueDate: '2026-08-14T00:00:00.000Z',
    status: 'DRAFT',
    totalAmount: '30000',
    contract: { customer: { id: 'c', name: '고객C', email: 'c@example.com' } },
  },
];

describe('DashboardPage', () => {
  it('renders the dashboard heading for every role', () => {
    renderWithProviders(<DashboardPage />, { token: SALES_TOKEN });
    expect(screen.getByRole('heading', { name: '청구 시스템 관리자 대시보드' })).toBeInTheDocument();
  });

  it('shows financial summary, monthly revenue, and top customers for ACCOUNTING/ADMIN', async () => {
    server.use(http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)));

    renderWithProviders(<DashboardPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('350,000.5원')).toBeInTheDocument());
    expect(screen.getByText('30,000원')).toBeInTheDocument();
    expect(screen.getByText('4건')).toBeInTheDocument();

    // Monthly breakdown, most recent month first
    const monthRows = screen.getAllByText(/^2026-0[67]$/).map((el) => el.closest('tr'));
    expect(monthRows[0]).toHaveTextContent('2026-07');
    expect(monthRows[0]).toHaveTextContent('250,000.5원');
    expect(monthRows[1]).toHaveTextContent('2026-06');
    expect(monthRows[1]).toHaveTextContent('100,000원');

    // Top customers, highest revenue first
    const customerRows = screen.getAllByText(/^고객[AB]$/).map((el) => el.closest('tr'));
    expect(customerRows[0]).toHaveTextContent('고객B');
    expect(customerRows[0]).toHaveTextContent('200,000원');
    expect(customerRows[1]).toHaveTextContent('고객A');
    expect(customerRows[1]).toHaveTextContent('150,000.5원');
  });

  it('does not attempt to load invoice data for SALES (no backend access to /admin/invoices)', async () => {
    // No MSW handler registered for GET /admin/invoices on purpose. This
    // alone doesn't fail the test if the query fires anyway — TanStack
    // Query swallows the rejection into query-error state rather than
    // throwing — so assert directly on the query's fetchStatus/status
    // instead (mirrors the proof pattern used in
    // invoice-detail-page.spec.tsx's SALES-guard test).
    const { queryClient } = renderWithProviders(<DashboardPage />, { token: SALES_TOKEN });

    await waitFor(() => expect(screen.getByText('영업 담당자 메뉴')).toBeInTheDocument());
    expect(screen.queryByText('총 청구서')).not.toBeInTheDocument();
    expect(queryClient.getQueryState(['invoices'])?.fetchStatus).toBe('idle');
    expect(queryClient.getQueryState(['invoices'])?.status).toBe('pending');
  });
});
