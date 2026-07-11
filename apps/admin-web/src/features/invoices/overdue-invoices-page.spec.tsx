import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN, SALES_TOKEN } from '../../test/render-with-providers';
import { OverdueInvoicesPage } from './overdue-invoices-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const NOW = new Date('2026-07-11T00:00:00.000Z');

const invoices = [
  {
    id: 'invoice-overdue-1',
    contractId: 'contract-1',
    periodStart: '2026-05-01T00:00:00.000Z',
    periodEnd: '2026-05-31T00:00:00.000Z',
    issueDate: '2026-06-01T00:00:00.000Z',
    dueDate: '2026-06-15T00:00:00.000Z',
    status: 'SENT',
    totalAmount: '150000.50',
    contract: { customer: { id: 'c1', name: '연체고객', email: 'c1@example.com' } },
  },
  {
    id: 'invoice-not-due-yet',
    contractId: 'contract-2',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-31T00:00:00.000Z',
    issueDate: '2026-07-05T00:00:00.000Z',
    dueDate: '2026-08-14T00:00:00.000Z',
    status: 'SENT',
    totalAmount: '50000',
    contract: { customer: { id: 'c2', name: '정상고객', email: 'c2@example.com' } },
  },
  {
    id: 'invoice-draft-past-due-conceptually',
    contractId: 'contract-3',
    periodStart: '2026-05-01T00:00:00.000Z',
    periodEnd: '2026-05-31T00:00:00.000Z',
    issueDate: null,
    dueDate: '2026-06-01T00:00:00.000Z',
    status: 'DRAFT',
    totalAmount: '99999.50',
    contract: { customer: { id: 'c3', name: '초안고객', email: 'c3@example.com' } },
  },
];

describe('OverdueInvoicesPage', () => {
  beforeEach(() => {
    // Only fake Date — faking setTimeout/setInterval too would freeze
    // testing-library's `waitFor` polling, since it doesn't auto-advance.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists only SENT invoices past their due date, with days overdue and a precise total', async () => {
    server.use(http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)));

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('연체고객')).toBeInTheDocument());

    expect(screen.queryByText('정상고객')).not.toBeInTheDocument();
    expect(screen.queryByText('초안고객')).not.toBeInTheDocument();
    expect(screen.getByText('26일')).toBeInTheDocument();
    expect(screen.getByText('총 미수금: 150,000.5원 (1건)')).toBeInTheDocument();
  });

  it('shows an empty-state message when nothing is overdue', async () => {
    server.use(http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json([invoices[1]])));

    renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: ACCOUNTING_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(screen.getByText('연체된 청구서가 없습니다.')).toBeInTheDocument());
  });

  it('blocks SALES users, even via direct navigation', async () => {
    server.use(http.get(`${API_URL}/admin/invoices`, () => HttpResponse.json(invoices)));

    const { queryClient } = renderWithProviders(
      <Routes>
        <Route path="/invoices/overdue" element={<OverdueInvoicesPage />} />
      </Routes>,
      { token: SALES_TOKEN, route: '/invoices/overdue' },
    );

    await waitFor(() => expect(queryClient.getQueryState(['invoices'])?.status).toBe('success'));

    expect(screen.queryByText('연체고객')).not.toBeInTheDocument();
  });
});
