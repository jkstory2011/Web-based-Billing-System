import { screen, waitFor, fireEvent } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN, SALES_TOKEN } from '../../test/render-with-providers';
import { InvoiceDetailPage } from './invoice-detail-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const draftInvoice = {
  id: 'invoice-1',
  contractId: 'contract-1',
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-07-31T00:00:00.000Z',
  dueDate: '2026-08-14T00:00:00.000Z',
  issueDate: null,
  status: 'DRAFT',
  totalAmount: '150000',
  lineItems: [
    { id: 'line-1', invoiceId: 'invoice-1', description: '월 이용료', quantity: 1, unitPrice: '150000', amount: '150000', source: 'RECURRING' },
  ],
};

function renderDetailPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
    </Routes>,
    { token: ACCOUNTING_TOKEN, route: '/invoices/invoice-1' },
  );
}

describe('InvoiceDetailPage', () => {
  it('issues the invoice and shows the success message', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices/invoice-1`, () => HttpResponse.json(draftInvoice)),
      http.post(`${API_URL}/admin/invoices/invoice-1/issue`, () =>
        HttpResponse.json({ ...draftInvoice, status: 'SENT', issueDate: '2026-07-11T00:00:00.000Z' }),
      ),
    );

    renderDetailPage();

    await waitFor(() => expect(screen.getByText('월 이용료')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /발행/ }));

    await waitFor(() => expect(screen.getByText('발행이 완료되어 이메일로 발송되었습니다.')).toBeInTheDocument());
  });

  it('shows an error message when issuing fails', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices/invoice-1`, () => HttpResponse.json(draftInvoice)),
      http.post(`${API_URL}/admin/invoices/invoice-1/issue`, () =>
        HttpResponse.json({ statusCode: 500, message: '메일 발송에 실패했습니다.' }, { status: 500 }),
      ),
    );

    renderDetailPage();

    await waitFor(() => expect(screen.getByText('월 이용료')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /발행/ }));

    await waitFor(() => expect(screen.getByText('메일 발송에 실패했습니다.')).toBeInTheDocument());
  });

  it('disables the issue button and shows a pending label while the request is in flight', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices/invoice-1`, () => HttpResponse.json(draftInvoice)),
      http.post(`${API_URL}/admin/invoices/invoice-1/issue`, async () => {
        await delay(50);
        return HttpResponse.json({ ...draftInvoice, status: 'SENT', issueDate: '2026-07-11T00:00:00.000Z' });
      }),
    );

    renderDetailPage();

    await waitFor(() => expect(screen.getByText('월 이용료')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /발행/ }));

    const pendingButton = await screen.findByRole('button', { name: '발행 중...' });
    expect(pendingButton).toBeDisabled();

    await waitFor(() => expect(screen.getByText('발행이 완료되어 이메일로 발송되었습니다.')).toBeInTheDocument());
  });

  it('shows an error message when the PDF download fails', async () => {
    const sentInvoice = { ...draftInvoice, status: 'SENT', issueDate: '2026-07-11T00:00:00.000Z' };
    server.use(
      http.get(`${API_URL}/admin/invoices/invoice-1`, () => HttpResponse.json(sentInvoice)),
      http.get(`${API_URL}/admin/invoices/invoice-1/pdf`, () => HttpResponse.json({ message: 'not found' }, { status: 404 })),
    );

    renderDetailPage();

    await waitFor(() => expect(screen.getByText('월 이용료')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /PDF 다운로드/ }));

    await waitFor(() => expect(screen.getByText('PDF를 불러오지 못했습니다.')).toBeInTheDocument());
  });

  it('blocks SALES users from the invoice detail page, even via direct navigation', async () => {
    server.use(http.get(`${API_URL}/admin/invoices/invoice-1`, () => HttpResponse.json(draftInvoice)));

    const { queryClient } = renderWithProviders(
      <Routes>
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
      </Routes>,
      { token: SALES_TOKEN, route: '/invoices/invoice-1' },
    );

    // Wait for the underlying query to genuinely settle. If this test only
    // asserted synchronously (before the query resolves), it would pass
    // trivially because of the page's `isLoading` gate, not because the role
    // guard fired — regardless of whether the guard exists at all.
    await waitFor(() => expect(queryClient.getQueryState(['invoices', 'invoice-1'])?.status).toBe('success'));

    expect(screen.queryByText('월 이용료')).not.toBeInTheDocument();
  });
});
