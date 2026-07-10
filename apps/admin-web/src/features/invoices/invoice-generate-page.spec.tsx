import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN, SALES_TOKEN } from '../../test/render-with-providers';
import { InvoiceGeneratePage } from './invoice-generate-page';

const API_URL = import.meta.env.VITE_API_URL as string;

describe('InvoiceGeneratePage', () => {
  it('previews then generates invoices for the selected period', async () => {
    let generateCalled = false;
    server.use(
      http.post(`${API_URL}/admin/invoices/preview`, () =>
        HttpResponse.json([{ contractId: 'contract-1', recurringItems: [{ id: 'r1' }], adhocCharges: [] }]),
      ),
      http.post(`${API_URL}/admin/invoices/generate`, () => {
        generateCalled = true;
        return HttpResponse.json([{ id: 'invoice-1' }]);
      }),
    );

    renderWithProviders(<InvoiceGeneratePage />, { token: ACCOUNTING_TOKEN });

    fireEvent.change(screen.getByLabelText('청구 기간 시작'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('청구 기간 종료'), { target: { value: '2026-07-31' } });
    fireEvent.click(screen.getByRole('button', { name: '미리보기' }));

    await waitFor(() => expect(screen.getByText(/대상 계약 1건/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '일괄 생성' }));

    await waitFor(() => expect(generateCalled).toBe(true));
  });

  it('blocks SALES users from the generation form, even via direct navigation', () => {
    renderWithProviders(<InvoiceGeneratePage />, { token: SALES_TOKEN });

    expect(screen.queryByText('청구서 생성')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('청구 기간 시작')).not.toBeInTheDocument();
  });
});
