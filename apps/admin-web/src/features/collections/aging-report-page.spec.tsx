import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN, SALES_TOKEN } from '../../test/render-with-providers';
import { AgingReportPage } from './aging-report-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const summaries = [
  {
    customerId: 'c1',
    customerName: '연체고객A',
    buckets: { d0to30: '100000', d31to60: '200000', d61to90: '0', d90plus: '0' },
    totalOverdue: '300000',
    invoiceCount: 2,
  },
];

function renderAgingPage(token: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/collections/aging" element={<AgingReportPage />} />
    </Routes>,
    { token, route: '/collections/aging' },
  );
}

describe('AgingReportPage', () => {
  it('shows per-customer aging buckets and a grand total row', async () => {
    server.use(http.get(`${API_URL}/admin/collections/aging`, () => HttpResponse.json(summaries)));

    renderAgingPage(ACCOUNTING_TOKEN);

    await waitFor(() => expect(screen.getByText('연체고객A')).toBeInTheDocument());
    expect(screen.getByText('전체 합계')).toBeInTheDocument();
  });

  it('shows an empty-state message when nothing is overdue', async () => {
    server.use(http.get(`${API_URL}/admin/collections/aging`, () => HttpResponse.json([])));

    renderAgingPage(ACCOUNTING_TOKEN);

    await waitFor(() => expect(screen.getByText('연체된 채권이 없습니다.')).toBeInTheDocument());
  });

  it('blocks SALES users, even via direct navigation', async () => {
    server.use(http.get(`${API_URL}/admin/collections/aging`, () => HttpResponse.json(summaries)));

    renderAgingPage(SALES_TOKEN);

    expect(screen.queryByText('연체고객A')).not.toBeInTheDocument();
  });
});
