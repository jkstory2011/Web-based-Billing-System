import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, PORTAL_TOKEN } from '../../test/render-with-providers';
import { InvoicesListPage } from './invoices-list-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const invoices = [
  {
    id: 'invoice-1',
    contractId: 'contract-1',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-31T00:00:00.000Z',
    issueDate: '2026-07-11T00:00:00.000Z',
    dueDate: '2026-08-14T00:00:00.000Z',
    status: 'SENT',
    totalAmount: '150000',
    lineItems: [],
  },
];

describe('InvoicesListPage', () => {
  it('renders the list of invoices with a link to each detail page', async () => {
    server.use(http.get(`${API_URL}/portal/invoices`, () => HttpResponse.json(invoices)));

    renderWithProviders(
      <Routes>
        <Route path="/" element={<InvoicesListPage />} />
      </Routes>,
      { token: PORTAL_TOKEN },
    );

    await waitFor(() => expect(screen.getByText('150000원')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /2026-07-01/ })).toHaveAttribute('href', '/invoices/invoice-1');
  });

  it('shows an empty-state message when there are no invoices', async () => {
    server.use(http.get(`${API_URL}/portal/invoices`, () => HttpResponse.json([])));

    renderWithProviders(
      <Routes>
        <Route path="/" element={<InvoicesListPage />} />
      </Routes>,
      { token: PORTAL_TOKEN },
    );

    await waitFor(() => expect(screen.getByText('발행된 청구서가 없습니다.')).toBeInTheDocument());
  });
});
