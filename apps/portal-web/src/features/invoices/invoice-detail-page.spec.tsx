import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, PORTAL_TOKEN } from '../../test/render-with-providers';
import { InvoiceDetailPage } from './invoice-detail-page';

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
    lineItems: [
      { id: 'line-1', invoiceId: 'invoice-1', description: '월 이용료', quantity: 1, unitPrice: '150000', amount: '150000', source: 'RECURRING' },
    ],
  },
];

function renderDetailPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
    </Routes>,
    { token: PORTAL_TOKEN, route: '/invoices/invoice-1' },
  );
}

describe('InvoiceDetailPage', () => {
  it('renders the invoice line items and total', async () => {
    server.use(http.get(`${API_URL}/portal/invoices`, () => HttpResponse.json(invoices)));

    renderDetailPage();

    await waitFor(() => expect(screen.getByText('월 이용료')).toBeInTheDocument());
    expect(screen.getByText('150000원')).toBeInTheDocument();
  });

  it('downloads the PDF when the button is clicked', async () => {
    server.use(
      http.get(`${API_URL}/portal/invoices`, () => HttpResponse.json(invoices)),
      http.get(`${API_URL}/portal/invoices/invoice-1/pdf`, () => HttpResponse.arrayBuffer(new ArrayBuffer(4))),
    );

    renderDetailPage();

    await waitFor(() => expect(screen.getByText('월 이용료')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'PDF 다운로드' }));

    await waitFor(() => expect(screen.queryByText(/실패/)).not.toBeInTheDocument());
  });

  it('shows a not-found message for an unknown invoice id', async () => {
    server.use(http.get(`${API_URL}/portal/invoices`, () => HttpResponse.json(invoices)));

    renderWithProviders(
      <Routes>
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
      </Routes>,
      { token: PORTAL_TOKEN, route: '/invoices/unknown-id' },
    );

    await waitFor(() => expect(screen.getByText('청구서를 찾을 수 없습니다.')).toBeInTheDocument());
  });
});
